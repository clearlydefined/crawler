// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const { clone } = require('lodash')
const domain = require('domain')
const fs = require('fs')
const memCache = require('memory-cache')
const nodeRequest = require('request')
const FetchResult = require('../../lib/fetchResult')

const condaChannels = {
  'anaconda-main': 'https://repo.anaconda.com/pkgs/main',
  'anaconda-r': 'https://repo.anaconda.com/pkgs/r',
  'conda-forge': 'https://conda.anaconda.org/conda-forge'
}

class CondaFetch extends AbstractFetch {
  constructor(options) {
    super(options)
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && condaChannels[spec.provider]
  }

  //      {type: conda|condasource}/{provider: anaconda-main|anaconda-r|conda-forge}/-/{package name}/[{archictecture | _}--][{version | _}]-[{build version | _}]/[{tool version}]
  // i.e. conda/conda-forge/-/numpy/linux-aarch64--1.13.0-py36/
  //      conda/conda-forge/-/numpy/-py36/
  //      conda/conda-forge/-/numpy/1.13.0-py36/
  //      conda/conda-forge/-/numpy/linux-aarch64--_-py36/
  //      conda/conda-forge/-/numpy/
  //      conda/conda-forge/-/numpy/_--_-_
  async handle(request) {
    const spec = this.toSpec(request)
    if (!condaChannels[spec.provider]) {
      return request.markSkip(`Unrecognized conda provider: ${spec.provider}, must be either of: ${Object.keys(condaChannels)}`)
    }
    const channelData = await this._getChannelData(condaChannels[spec.provider], spec.provider)
    let [architecture, revision] = (spec.revision || '').split('--')

    // both arch and revision or revision only
    if (architecture && !revision) {
      revision = architecture
      architecture = null
    }

    let [version, buildVersion] = (revision || '').split('-')

    if (channelData.packages[spec.name] === undefined) {
      return request.markSkip(`Missing package ${spec.name} in channelData`)
    }

    const packageChannelData = channelData.packages[spec.name]
    if (spec.type !== 'conda' && spec.type !== 'condasource') {
      return request.markSkip('spec type must either be conda or condasource')
    }

    // unless otherwise specified, we fetch the architecture package
    if (spec.type !== 'conda' && packageChannelData.subdirs.length === 0) {
      return request.markSkip('No architecture build in package channel data')
    }

    if ((!architecture || architecture === '_') && spec.type === 'conda') {
      // prefer no-arch if available
      architecture = packageChannelData.subdirs.includes('noarch') ? 'noarch' : packageChannelData.subdirs[0]
      this.logger.info(`No binary architecture specified for ${spec.name}, using architecture: ${architecture}`)
    }

    if (spec.type === 'condasource') {
      return this._downloadCondaSourcePackage(spec, request, version, packageChannelData)
    } else {
      return this._downloadCondaPackage(
        spec,
        request,
        version,
        buildVersion,
        architecture,
        packageChannelData
      )
    }
  }

  async _downloadCondaSourcePackage(spec, request, version, packageChannelData) {
    if (version && version !== '_' && packageChannelData.version !== version) {
      return request.markSkip(`Missing source file version ${version} for package ${spec.name}`)
    }
    if (!packageChannelData.source_url) {
      return request.markSkip(`Missing archive source file in repodata for package ${spec.name}`)
    }
    let downloadUrl = new URL(`${packageChannelData.source_url}`).href

    spec.revision = packageChannelData.version
    request.url = spec.toUrl()
    super.handle(request)

    const file = this.createTempFile(request)
    const dir = this.createTempDir(request)

    await this._downloadPackage(downloadUrl, file.name)
    await this.decompress(file.name, dir.name)
    const hashes = await this.computeHashes(file.name)

    const fetchResult = new FetchResult(request.url)
    fetchResult.document = {
      location: dir.name,
      registryData: { 'channelData': packageChannelData, downloadUrl },
      releaseDate: new Date(packageChannelData.timestamp).toUTCString(),
      declaredLicenses: packageChannelData.license,
      hashes
    }

    fetchResult.casedSpec = clone(spec)
    request.fetchResult = fetchResult.adoptCleanup(dir, request)
    return request
  }

  async _downloadCondaPackage(spec, request, version, buildVersion, architecture, packageChannelData) {
    let repoData = undefined
    if (!(packageChannelData.subdirs.find(x => x === architecture))) {
      return request.markSkip(`Missing architecture ${architecture} in channel`)
    }
    repoData = await this._getRepoData(condaChannels[spec.provider], spec.provider, architecture)

    let packageRepoEntries = []
    let packageMatches = ([, packageData]) => {
      return packageData.name === spec.name && ((!version) || version === '_' || version === packageData.version)
        && ((!buildVersion) || buildVersion === '_' || packageData.build.startsWith(buildVersion))
    }

    if (repoData['packages']) {
      packageRepoEntries = packageRepoEntries.concat(Object.entries(repoData['packages'])
        .filter(packageMatches)
        .map(([packageFile, packageData]) => { return { packageFile, packageData } }))
    }

    if (repoData['packages.conda']) {
      packageRepoEntries = packageRepoEntries.concat(Object.entries(repoData['packages.conda'])
        .filter(packageMatches)
        .map(([packageFile, packageData]) => { return { packageFile, packageData } }))
    }

    packageRepoEntries.sort((a, b) => {
      if (a.packageData.build < b.packageData.build) {
        return 1
      } else if (a.packageData.build === b.packageData.build) {
        return 0
      }
      else {
        return -1
      }
    })

    let packageRepoEntry = packageRepoEntries[0]
    if (!packageRepoEntry) {
      return request.markSkip(`Missing package with matching spec (version: ${version}, buildVersion: ${buildVersion}) in ${architecture} repository`)
    }

    let downloadUrl = new URL(`${condaChannels[spec.provider]}/${architecture}/${packageRepoEntry.packageFile}`).href

    spec.revision = architecture + '--' + packageRepoEntry.packageData.version + '-' + packageRepoEntry.packageData.build
    request.url = spec.toUrl()
    super.handle(request)

    const file = this.createTempFile(request)
    const dir = this.createTempDir(request)

    await this._downloadPackage(downloadUrl, file.name)
    await this.decompress(file.name, dir.name)
    const hashes = await this.computeHashes(file.name)

    const fetchResult = new FetchResult(request.url)
    fetchResult.document = {
      location: dir.name,
      registryData: { 'channelData': packageChannelData, 'repoData': packageRepoEntry, downloadUrl },
      releaseDate: new Date(packageRepoEntry.packageData.timestamp).toUTCString(),
      declaredLicenses: packageRepoEntry.packageData.license,
      hashes
    }

    fetchResult.casedSpec = clone(spec)

    request.fetchResult = fetchResult.adoptCleanup(dir, request)
    return request
  }

  async _downloadPackage(downloadUrl, destination) {
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


  async _cachedDownload(cacheKey, sourceUrl, cacheDuration, fileDstLocation) {
    if (!memCache.get(cacheKey)) {
      memCache.put(cacheKey, true, cacheDuration)
      return new Promise((resolve, reject) => {
        const dom = domain.create()
        dom.on('error', error => {
          memCache.del(cacheKey)
          return reject(error)
        })
        dom.run(() => {
          nodeRequest
            .get(sourceUrl)
            .pipe(fs.createWriteStream(fileDstLocation))
            .on('finish', () => {
              this.logger.info(
                `Conda: retrieved ${sourceUrl}. Stored channel data file at ${fileDstLocation}`
              )
              return resolve()
            })
        })
      })
    }
  }


  async _getChannelData(condaChannelUrl, condaChannelID) {
    // ~10MB file, needs to be cached
    let channelDataFile = {
      url: `${condaChannelUrl}/channeldata.json`,
      cacheKey: `${condaChannelID}-channelDataFile`,
      cacheDuration: 8 * 60 * 60 * 1000,// 8 hours
      fileLocation: `${condaChannelID}-channelDataFile.json`
    }
    await this._cachedDownload(channelDataFile.cacheKey, channelDataFile.url,
      channelDataFile.cacheDuration, channelDataFile.fileLocation)
    let fileText = fs.readFileSync(channelDataFile.fileLocation)
    return JSON.parse(fileText)
  }

  async _getRepoData(condaChannelUrl, condaChannelID, architecture) {
    // ~30MB file, needs to be cached
    let repoFile = {
      url: `${condaChannelUrl}/${architecture}/repodata.json`,
      cacheKey: `${condaChannelID}-repoDataFile-${architecture}`,
      cacheDuration: 8 * 60 * 60 * 1000,// 8 hours
      fileLocation: `${condaChannelID}-repoDataFile-${architecture}.json`
    }
    await this._cachedDownload(repoFile.cacheKey, repoFile.url,
      repoFile.cacheDuration, repoFile.fileLocation)
    let fileText = fs.readFileSync(repoFile.fileLocation)
    return JSON.parse(fileText)
  }
}

module.exports = options => new CondaFetch(options)
