// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const bz2 = require('unbzip2-stream')
const { clone, flatten } = require('lodash')
const domain = require('domain')
const fs = require('fs')
const linebyline = require('linebyline')
const memCache = require('memory-cache')
const nodeRequest = require('request')
const path = require('path')
const { promisify } = require('util')
const { callFetch: requestPromise } = require('../../lib/fetch')
const tmp = require('tmp')
const unixArchive = require('ar-async')
const FetchResult = require('../../lib/fetchResult')

const exec = promisify(require('child_process').exec)
const exists = promisify(fs.exists)
const lstat = promisify(fs.lstat)
const readdir = promisify(fs.readdir)
const readFile = promisify(fs.readFile)

const providerMap = {
  debian: 'http://ftp.debian.org/debian/'
}

const packageFileMap = {
  url: 'http://ftp.debian.org/debian/indices/package-file.map.bz2',
  cacheKey: 'packageFileMap',
  cacheDuration: 8 * 60 * 60 * 1000 // 8 hours
}

const metadataChangelogsUrl = 'https://metadata.ftp-master.debian.org/changelogs/'

class DebianFetch extends AbstractFetch {
  constructor(options) {
    super(options)
    this.packageMapFileLocation = this.options.cdFileLocation + '-package-file.map'
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'debian'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    if (!spec.revision) spec.revision = await this._getLatestVersion(spec)
    if (!spec.revision) return request.markSkip('Missing  ')
    const registryData = await this._getRegistryData(spec)
    if (registryData.length === 0) return this.markSkip(request)
    const isArchitceturePresent = this._ensureArchitecturePresenceForBinary(spec, registryData)
    if (!isArchitceturePresent) return request.markSkip('Missing architecture  ')
    request.url = spec.toUrl()
    super.handle(request)
    const { binary, source, patches } = this._getDownloadUrls(spec, registryData)
    if (!binary && !source) return request.markSkip('Missing  ')
    const { dir, releaseDate, hashes } = await this._getPackage(request, binary, source, patches)
    const copyrightUrl = this._getCopyrightUrl(registryData)
    const declaredLicenses = await this._getDeclaredLicenses(copyrightUrl)

    const fetchResult = new FetchResult(request.url)
    fetchResult.document = this._createDocument({
      dir,
      registryData,
      releaseDate,
      copyrightUrl,
      declaredLicenses,
      hashes
    })
    fetchResult.casedSpec = clone(spec)
    request.fetchResult = fetchResult.adoptCleanup(dir, request)
    return request
  }

  // Query Debian to get the latest version if we don't already have that.
  // Example: https://sources.debian.org/api/src/amoeba/latest
  async _getLatestVersion(spec) {
    const url = `https://sources.debian.org/api/src/${spec.name}/latest`
    const response = await requestPromise({ url, json: true })
    return response.version
  }

  _createDocument({ dir, registryData, releaseDate, copyrightUrl, declaredLicenses, hashes }) {
    return { location: dir.name, registryData, releaseDate, copyrightUrl, declaredLicenses, hashes }
  }

  async _getRegistryData(spec) {
    await this._getPackageMapFile()
    return this._getDataFromPackageMapFile(spec)
  }

  // The assumption is that package/source/patch locations may change under http://ftp.debian.org/debian/pool/
  // That's why the package file with updated locations is downloaded, uncompressed, and stored locally for a few hours.
  async _getPackageMapFile() {
    if (!memCache.get(packageFileMap.cacheKey)) {
      memCache.put(packageFileMap.cacheKey, true, packageFileMap.cacheDuration)
      return new Promise((resolve, reject) => {
        const dom = domain.create()
        dom.on('error', error => {
          memCache.del(packageFileMap.cacheKey)
          return reject(error)
        })
        dom.run(() => {
          nodeRequest
            .get(packageFileMap.url)
            .pipe(bz2())
            .pipe(fs.createWriteStream(this.packageMapFileLocation))
            .on('finish', () => {
              this.logger.info(
                `Debian: retrieved ${packageFileMap.url}. Stored map file at ${this.packageMapFileLocation}`
              )
              return resolve()
            })
        })
      })
    }
  }

  // Return only the relevant entries from 160+ MB file
  // Sample: /test/fixtures/debian/fragment-package-file.map
  async _getDataFromPackageMapFile(spec) {
    return new Promise((resolve, reject) => {
      const { name, revision } = this._fromSpec(spec)
      const relevantEntries = []
      let entry = {}
      const lineReader = linebyline(this.packageMapFileLocation)
      lineReader
        .on('line', line => {
          if (line === '') {
            if (
              [entry.Source, entry.Binary].includes(name) &&
              [entry['Source-Version'], entry['Binary-Version']].includes(revision)
            ) {
              relevantEntries.push(entry)
              entry = {}
            }
          } else {
            const [key, value] = line.split(': ')
            entry[key] = value
          }
        })
        .on('end', () => {
          this.logger.info(`Debian: got ${relevantEntries.length} entries for ${spec.toUrl()}`)
          return resolve(relevantEntries)
        })
        .on('error', error => reject(error))
    })
  }

  _fromSpec(spec) {
    const { name } = spec
    const [revision, architecture] = spec.revision.split('_')
    return { name, revision, architecture }
  }

  _ensureArchitecturePresenceForBinary(spec, registryData) {
    const { architecture } = this._fromSpec(spec)
    if (spec.type === 'deb' && !architecture) {
      const randomBinaryArchitecture = (registryData.find(entry => entry.Architecture) || {}).Architecture
      if (!randomBinaryArchitecture) return false
      spec.revision += '_' + randomBinaryArchitecture
    }
    return true
  }

  _getDownloadUrls(spec, registryData) {
    const isSrc = spec.type === 'debsrc'
    const { architecture } = this._fromSpec(spec)
    if (isSrc) {
      const sourceAndPatches = registryData.filter(entry => !entry.Architecture && !entry.Path.endsWith('.dsc'))
      const sourcePath = (sourceAndPatches.find(entry => entry.Path.includes('.orig.tar.')) || {}).Path
      const source = sourcePath ? new URL(providerMap.debian + sourcePath).href : null
      const patchPath = (sourceAndPatches.find(entry => !entry.Path.includes('.orig.tar.')) || {}).Path
      const patches = patchPath ? new URL(providerMap.debian + patchPath).href : null
      return { source, patches }
    }
    const binary = new URL(providerMap.debian + registryData.find(entry => entry.Architecture === architecture).Path)
      .href
    return { binary }
  }

  async _getPackage(request, binary, source, patches) {
    const file = this.createTempFile(request)
    await this._download(binary || source, file.name)
    const dir = this.createTempDir(request)
    binary ? await this._decompressUnixArchive(file.name, dir.name) : await this.decompress(file.name, dir.name)
    const hashes = await this.computeHashes(file.name)
    let releaseDate = null
    if (binary) {
      // The decompressed folder should contain control.tar.xz, data.tar.xz, debian-binary. The package is in data.tar.xz
      if (await exists(path.join(dir.name, 'data.tar.xz')))
        await this.decompress(path.join(dir.name, 'data.tar.xz'), path.join(dir.name, 'data'))
      if (await exists(path.join(dir.name, 'data')))
        releaseDate = await this._getLatestFileDateFromDirectory(path.join(dir.name, 'data'))
    }
    if (source && patches) {
      const sourceDirectoryName = await this._getSourceDirectoryName(dir.name)
      const patchFile = tmp.fileSync(this.tmpOptions)
      await this._download(patches, patchFile.name)
      // Extracting patches into the sources folder to make sure copyrights etc. information is not lost.
      await this.decompress(patchFile.name, dir.name)
      patchFile.removeCallback()
      releaseDate = await this._getLatestFileDateFromDirectory(dir.name)
      await this._applyPatches(path.join(dir.name, sourceDirectoryName), path.join(dir.name, 'debian'), request.url)
    }
    return { dir, releaseDate, hashes }
  }

  async _download(downloadUrl, destination) {
    return new Promise((resolve, reject) => {
      const dom = domain.create()
      dom.on('error', error => reject(error))
      dom.run(() => {
        nodeRequest
          .get(downloadUrl, (error, response) => {
            if (error) return reject(error)
            if (response.statusCode !== 200)
              return reject(new Error(`${response.statusCode} ${response.statusMessage}`))
          })
          .pipe(fs.createWriteStream(destination))
          .on('finish', () => resolve())
      })
    })
  }

  async _decompressUnixArchive(source, destination) {
    return new Promise((resolve, reject) => {
      const reader = new unixArchive.ArReader(source)
      reader.on('entry', (entry, next) => {
        const name = entry.fileName()
        const fullName = path.join(destination, name)
        entry.fileData().pipe(fs.createWriteStream(fullName)).on('finish', next)
      })
      reader.on('error', error => {
        reject(error)
      })
      reader.on('end', () => {
        resolve()
      })
    })
  }

  // Attempt to guess the release date.
  // When a directory is extracted, all folders are newly created but the files retain their original last modified date,
  // so attempting to find the latest file date.
  async _getLatestFileDateFromDirectory(location) {
    let latestDate = null
    const fileLocations = await this._getFiles(location)
    for (let location of fileLocations) {
      const locationStat = await lstat(location)
      if (!locationStat.isDirectory()) {
        const { mtime } = locationStat
        if (!latestDate || mtime > latestDate) {
          latestDate = mtime
        }
      }
    }
    return latestDate
  }

  async _getFiles(location) {
    const locationStat = await lstat(location)
    if (locationStat.isSymbolicLink()) return []
    if (!locationStat.isDirectory()) return [location]
    const subdirs = await readdir(location)
    const files = await Promise.all(
      subdirs.map(subdir => {
        const entry = path.resolve(location, subdir)
        return this._getFiles(entry)
      })
    )
    return flatten(files).filter(x => x)
  }

  async _getSourceDirectoryName(location) {
    return (await readdir(location))[0]
  }

  // Apply patches to source in correct order
  async _applyPatches(sourceLocation, patchesLocation, specUrl) {
    const patchesSeriesLocation = path.join(patchesLocation, 'patches', 'series')
    if (await exists(patchesSeriesLocation)) {
      const orderedPatches = (await readFile(patchesSeriesLocation))
        .toString()
        .split('\n')
        .filter(patch => patch && !patch.trim().startsWith('#') && !patch.trim().startsWith('|'))
      for (let patchFileName of orderedPatches) {
        const patchCommand = `patch -p01 -i ${path.join(patchesLocation, 'patches', patchFileName)}`
        try {
          const { stdout } = await exec(patchCommand, { cwd: sourceLocation })
          this.logger.info(`Debian: applied patch ${patchFileName} for ${specUrl}. stdout: ${stdout.trim()}`)
        } catch (error) {
          this.logger.info(`Debian: failed to apply patch ${patchFileName} for ${specUrl}. Error: ${error}`)
        }
      }
    }
  }

  _getCopyrightUrl(registryData) {
    const entry = registryData.find(entry => entry.Source)
    if (!entry) return null
    // Example: ./pool/main/0/0ad/0ad_0.0.17-1.debian.tar.xz -> main/0
    const pathFragment = entry.Path.replace('./pool/', '').split('/').slice(0, 2).join('/')
    const name = entry.Source
    const revision = entry['Source-Version']
    // Example: https://metadata.ftp-master.debian.org/changelogs/main/0/0ad-data/0ad-data_0.0.17-1_copyright
    return `${metadataChangelogsUrl}${pathFragment}/${name}/${name}_${revision}_copyright`
  }

  async _getDeclaredLicenses(copyrightUrl) {
    if (!copyrightUrl) return []
    let response = ''
    try {
      response = await requestPromise({ url: copyrightUrl, json: false })
    } catch (error) {
      if (error.statusCode === 404) return []
      else throw error
    }
    return this._parseDeclaredLicenses(response)
  }

  // https://wiki.debian.org/Proposals/CopyrightFormat
  // https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/#spdx
  _parseDeclaredLicenses(copyrightResponse) {
    const licensesSet = new Set()
    const licenses = copyrightResponse
      .split('\n')
      .filter(line => line.startsWith('License: '))
      .map(line => line.replace('License:', '').trim())
      .map(licenseId => {
        if (licenseId.includes('CPL') && !licenseId.includes('RSCPL')) licenseId = licenseId.replace('CPL', 'CPL-1.0')
        if (licenseId.toLowerCase().includes('expat')) licenseId = licenseId.replace(/expat/i, 'MIT')
        return licenseId
      })
    // Over-simplified parsing of edge cases:
    licenses.forEach(licenseId => {
      if (licenseId.includes(' or ') && !licenseId.includes(',')) {
        // A or B and C => (A OR B AND C)
        licenseId = licenseId.replace(' or ', ' OR ')
        licenseId = licenseId.replace(' and ', ' AND ')
        licensesSet.add('(' + licenseId + ')')
      } else if (licenseId.includes(' or ') && licenseId.includes(',')) {
        // A or B, and C => (A OR B) AND C
        licenseId = licenseId.replace(' or ', ' OR ')
        licenseId.split(' and ').forEach(part => {
          if (part.includes('OR') && part.endsWith(',')) {
            licensesSet.add('(' + part.replace(',', ')'))
          } else {
            licensesSet.add(part)
          }
        })
      } else if (licenseId.includes(' and ')) {
        licenseId.split(' and ').forEach(part => licensesSet.add(part))
      } else {
        licensesSet.add(licenseId)
      }
    })
    return Array.from(licensesSet)
  }
}

module.exports = options => new DebianFetch(options)
