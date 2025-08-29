// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const { clone } = require('lodash')
const fs = require('fs')
const memCache = require('memory-cache')
const { getStream: nodeRequest } = require('../../lib/fetch')
const FetchResult = require('../../lib/fetchResult')

class CondaFetch extends AbstractFetch {
  constructor(options) {
    super(options)
    this.packageMapPrefix = this.options.cdFileLocation
    this.channels = {
      'anaconda-main': 'https://repo.anaconda.com/pkgs/main',
      'anaconda-r': 'https://repo.anaconda.com/pkgs/r',
      'conda-forge': 'https://conda.anaconda.org/conda-forge'
    }
    this.headers = {
      'User-Agent': 'clearlydefined.io crawler (clearlydefined@outlook.com)'
    }
    this.CACHE_DURATION = 8 * 60 * 60 * 1000 // 8 hours
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && !!this.channels[spec.provider]
  }

  //      {type: conda|condasrc}/{provider: anaconda-main|anaconda-r|conda-forge}/{architecture|-}/{package name}/[{version | }]-[{build version | }]/
  // i.e. conda/conda-forge/linux-aarch64/numpy/1.13.0-py36/
  //      conda/conda-forge/-/numpy/-py36/
  //      conda/conda-forge/-/numpy/1.13.0-py36/
  //      conda/conda-forge/linux-aarch64/numpy/-py36/
  //      conda/conda-forge/-/numpy/
  //      conda/conda-forge/-/numpy/-
  async handle(request) {
    const spec = this.toSpec(request)
    if (spec.type !== 'conda' && spec.type !== 'condasrc') {
      return request.markSkip('spec type must either be conda or condasrc')
    }
    const channelData = await this.getChannelData(this.channels[spec.provider], spec.provider)
    if (!channelData) {
      return request.markSkip('failed to fetch and parse channelData.json')
    }
    let architecture = spec.namespace
    let [version, buildVersion] = (spec.revision || '').split('-')
    if (channelData.packages[spec.name] === undefined) {
      return request.markSkip(`Missing package ${spec.name} in channel: ${spec.provider}`)
    }
    const packageChannelData = channelData.packages[spec.name]
    if (spec.type === 'condasrc') {
      return this._downloadCondaSourcePackage(spec, request, version, packageChannelData)
    } else {
      return this._downloadCondaPackage(spec, request, version, buildVersion, architecture, packageChannelData)
    }
  }

  async _downloadCondaSourcePackage(spec, request, version, packageChannelData) {
    if (version && packageChannelData.version !== version) {
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
      registryData: { channelData: packageChannelData, downloadUrl },
      releaseDate: new Date(packageChannelData.timestamp || 0).toISOString(),
      declaredLicenses: packageChannelData.license,
      hashes
    }
    fetchResult.casedSpec = clone(spec)
    request.fetchResult = fetchResult.adoptCleanup(dir, request)
    return request
  }

  _matchPackage(name, version, buildVersion, repoData) {
    let packageRepoEntries = []
    let packageMatches = ([, packageData]) => {
      return (
        packageData.name === name &&
        (!version || version === packageData.version) &&
        (!buildVersion || packageData.build.startsWith(buildVersion))
      )
    }
    if (repoData['packages']) {
      packageRepoEntries = packageRepoEntries.concat(
        Object.entries(repoData['packages'])
          .filter(packageMatches)
          .map(([packageFile, packageData]) => {
            return { packageFile, packageData }
          })
      )
    }
    if (repoData['packages.conda']) {
      packageRepoEntries = packageRepoEntries.concat(
        Object.entries(repoData['packages.conda'])
          .filter(packageMatches)
          .map(([packageFile, packageData]) => {
            return { packageFile, packageData }
          })
      )
    }
    packageRepoEntries.sort((a, b) => (b.packageData.timestamp || 0) - (a.packageData.timestamp || 0))
    return packageRepoEntries
  }

  async _downloadCondaPackage(spec, request, version, buildVersion, architecture, packageChannelData) {
    if (!architecture || (architecture === '-' && packageChannelData.subdirs.length > 0)) {
      // prefer no-arch if available
      architecture = packageChannelData.subdirs.includes('noarch') ? 'noarch' : packageChannelData.subdirs[0]
      this.logger.info(`No binary architecture specified for ${spec.name}, using architecture: ${architecture}`)
    }
    let repoData = undefined
    if (!packageChannelData.subdirs.find(x => x === architecture)) {
      return request.markSkip(`Missing architecture ${architecture} for package ${spec.name} in channel`)
    }
    repoData = await this.getRepoData(this.channels[spec.provider], spec.provider, architecture)
    if (!repoData) {
      return request.markSkip(
        `failed to fetch and parse repodata json file for channel ${spec.provider} in architecture ${architecture}`
      )
    }
    let packageRepoEntries = this._matchPackage(spec.name, version, buildVersion, repoData)
    if (packageRepoEntries.length === 0) {
      return request.markSkip(
        `Missing package with matching spec (version: ${version}, buildVersion: ${buildVersion}) in ${architecture} repository`
      )
    }
    let packageRepoEntry = packageRepoEntries[0]
    let downloadUrl = new URL(`${this.channels[spec.provider]}/${architecture}/${packageRepoEntry.packageFile}`).href
    spec.namespace = architecture
    spec.revision = packageRepoEntry.packageData.version + '-' + packageRepoEntry.packageData.build
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
      registryData: { channelData: packageChannelData, repoData: packageRepoEntry, downloadUrl },
      releaseDate: new Date(packageRepoEntry.packageData.timestamp || 0).toISOString(),
      declaredLicenses: packageRepoEntry.packageData.license,
      hashes
    }
    fetchResult.casedSpec = clone(spec)
    request.fetchResult = fetchResult.adoptCleanup(dir, request)
    return request
  }

  async _downloadPackage(downloadUrl, destination) {
    return new Promise((resolve, reject) => {
      const options = { url: downloadUrl, headers: this.headers }
      nodeRequest
        .getStream(options)
        .then(response => {
          if (response.statusCode !== 200) return reject(new Error(`${response.statusCode} ${response.message}`))
          response.pipe(fs.createWriteStream(destination)).on('finish', resolve)
        })
        .catch(error => {
          return reject(error)
        })
    })
  }

  async _cachedDownload(cacheKey, sourceUrl, cacheDuration, fileDstLocation) {
    if (!memCache.get(cacheKey)) {
      return new Promise((resolve, reject) => {
        const options = { url: sourceUrl, headers: this.headers }
        nodeRequest
          .get(options, (error, response) => {
            if (error) return reject(error)
            if (response.statusCode !== 200)
              return reject(new Error(`${response.statusCode} ${response.statusMessage}`))
          })
          .pipe(
            fs.createWriteStream(fileDstLocation).on('finish', () => {
              memCache.put(cacheKey, true, cacheDuration)
              this.logger.info(`Conda: retrieved ${sourceUrl}. Stored data file at ${fileDstLocation}`)
              return resolve()
            })
          )
      })
    }
  }

  async _fetchCachedJSONFile(cacheKey, url, cacheDuration, fileLocation) {
    try {
      await this._cachedDownload(cacheKey, url, cacheDuration, fileLocation)
    } catch (error) {
      return null
    }
    return JSON.parse(fs.readFileSync(fileLocation))
  }

  async getChannelData(condaChannelUrl, condaChannelID) {
    return await this._fetchCachedJSONFile(
      `${condaChannelID}-channelDataFile`,
      `${condaChannelUrl}/channeldata.json`,
      this.CACHE_DURATION,
      `${this.packageMapPrefix}-${condaChannelID}-channelDataFile.json`
    )
  }

  async getRepoData(condaChannelUrl, condaChannelID, architecture) {
    return await this._fetchCachedJSONFile(
      `${condaChannelID}-repoDataFile-${architecture}`,
      `${condaChannelUrl}/${architecture}/repodata.json`,
      this.CACHE_DURATION,
      `${this.packageMapPrefix}-${condaChannelID}-repoDataFile-${architecture}.json`
    )
  }
}

module.exports = options => new CondaFetch(options)
