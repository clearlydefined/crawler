// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const bz2 = require('unbzip2-stream')
const { clone } = require('lodash')
const domain = require('domain')
const fs = require('fs')
const linebyline = require('linebyline')
const memCache = require('memory-cache')
const nodeRequest = require('request')
const path = require('path')
const requestPromise = require('request-promise-native')

const providerMap = {
  debian: 'http://ftp.debian.org/debian/'
}

const packageFileMap = {
  url: 'http://ftp.debian.org/debian/indices/package-file.map.bz2',
  cacheKey: 'packageFileMap',
  cacheDuration: 8 * 60 * 60 * 1000 // 8 hours
}

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
    const isArchPresent = this._ensureArchitecturePresenceForBinary(spec, registryData)
    if (!isArchPresent) return request.markSkip('Missing architecture  ')
    request.url = spec.toUrl()
    super.handle(request)
    const { binary, source, patches } = this._getDownloadUrls(spec, registryData)
    const { dir, releaseDate, hashes } = await this._getPackage(request, binary, source, patches)
    request.document = await this._createDocument(dir, registryData, releaseDate, hashes)
    request.contentOrigin = 'origin'
    request.casedSpec = clone(spec)
    return request
  }

  // Query Debian to get the latest version if we don't already have that.
  // Example: https://sources.debian.org/api/src/amoeba/latest
  async _getLatestVersion(spec) {
    const url = `https://sources.debian.org/api/src/${spec.name}/latest`
    const response = await requestPromise({ url, json: true })
    return response.version
  }

  _createDocument(dir, registryData, releaseDate, hashes) {
    return { location: dir.name, registryData, releaseDate, hashes }
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
              this.logger.info(`Retrieved ${packageFileMap.url}. Stored map file at ${this.packageMapFileLocation}`)
              return resolve()
            })
        })
      })
    }
  }

  // Return only the relevant entries from 160+ MB file
  // Sample: /test/fixtures/debian/package-file.map
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
              [entry['Source'], entry['Binary']].includes(name) &&
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
          this.logger.info(`Got ${relevantEntries.length} entries for ${spec.toUrl()}`)
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
      const source = new URL(
        providerMap.debian + sourceAndPatches.find(entry => entry.Path.includes('.orig.tar.')).Path
      ).href
      const patches = new URL(
        providerMap.debian + sourceAndPatches.find(entry => !entry.Path.includes('.orig.tar.')).Path
      ).href
      return { source, patches }
    }
    const binary = new URL(
      providerMap.debian + registryData.find(entry => entry.Architecture && entry.Architecture === architecture).Path
    ).href
    return { binary }
  }

  async _getPackage(request, binary, source, patches) {
    const file = this.createTempFile(request)
    await this._download(binary || source, file.name)
    const dir = this.createTempDir(request)
    // !!!!
    await this.decompress(file.name, dir.name) // it doesn't work with .deb file, which is arch. Try streams instead? Before that test src.
    const hashes = await this.computeHashes(file.name)
    if (binary) {
      // The decompressed folder should contain control.tar.xz, data.tar.xz, debian-binary. The package is in data.tar.xz
      if (fs.existsSync(path.join(dir.name, 'data.tar.xz')))
        await this.decompress(`${dir.name}/data.tar.xz`, `${dir.name}/data`)
    }
    // TODO releaseDate
    if (source && patches) {
      // TODO assumption: only one patches URL
      // download and decompress patches
      // Apply patches in correct order: (new function)
      // cat ../debian/patches/series
      // FixDesktop.diff
      // FixPathBinary.diff
      // patch -p01 -i ../debian/patches/FixDesktop.diff
      // patch -p01 -i ../debian/patches/FixPathBinary.diff
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
}

module.exports = options => new DebianFetch(options)
