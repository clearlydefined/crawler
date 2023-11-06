// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const { clone, flatten } = require('lodash')
const domain = require('domain')
const fs = require('fs')
const memCache = require('memory-cache')
const nodeRequest = require('request')
const path = require('path')
const { promisify } = require('util')
const requestPromise = require('request-promise-native')
const tmp = require('tmp')
const unixArchive = require('ar-async')
const FetchResult = require('../../lib/fetchResult')

const exec = promisify(require('child_process').exec)
const exists = promisify(fs.exists)
const lstat = promisify(fs.lstat)
const readdir = promisify(fs.readdir)
const readFile = promisify(fs.readFile)

const condaChannels = {
  "anaconda-main": "https://repo.anaconda.com/pkgs/main",
  "anaconda-r": "https://repo.anaconda.com/pkgs/r",
  "conda-forge": "https://conda.anaconda.org/conda-forge"
}

class CondaFetch extends AbstractFetch {
  constructor(options) {
    super(options)
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type == "conda" && spec && (spec.type == 'conda' || spec.type == 'condasrc') && condaChannels[spec.provider]
  }

  // (conda|condasrc)/(conda-forge|anaconda-main|anaconda-r)/-/${package_name}/(${version})_(${architecture})/(${toolVersion}|-)
  // i.e. conda/conda-forge/-/numpy/1.13.0_linux-aarch64/py36
  //      conda/conda-forge/-/numpy/-/py36
  //      conda/conda-forge/-/numpy/1.13.0_/py36
  //      conda/conda-forge/-/numpy/_linux-aarch64/py36
  //      conda/anaconda-main/-/numpy/_/py27
  //      conda/anaconda-main/-/numpy/_/-
  async handle(request) {
    const spec = this.toSpec(request)
    const specStr = {
      type: spec.type,
      provider: spec.provider,
      namespace: spec.namespace,
      name: spec.name,
      revision: spec.revision,
      tool: spec.tool,
      toolVersion: spec.toolVersion
    }
    this.logger.info(specStr)
    if (!condaChannels[spec.provider]) {
      return request.markSkip(`Unrecognized conda provider: ${spec.provider}, must be either of: ${Object.keys(condaChannels)}`)
    }
    const channelData = await this._getChannelData(condaChannels[spec.provider], spec.provider)
    let [version, architecture] = spec.revision.split('_');
    if (channelData.packages[spec.name] == undefined) {
      return request.markSkip(`Missing package ${spec.name} in channelData`)
    }
    const packageChannelData = channelData.packages[spec.name];
    if (spec.type != "conda" && spec.type != "condasrc") {
      return request.markSkip(`spec type must either be conda or condasrc`)
    }
    // unless otherwise specified, we fetch the architecture package
    if (spec.type != "conda" && packageChannelData.subdirs.length == 0) {
      return request.markSkip('No architecture build in package channel data')
    }

    if ((!architecture || architecture == "-") && spec.type == "conda") {
      architecture = packageChannelData.subdirs[0];
      this.logger.info(`No binary architecture specified for ${spec.name}, using random architecture: ${architecture}`)
    }

    if (spec.toolVersion && spec.toolVersion != '-' && !spec.toolVersion.startsWith("py")) {
      request.markSkip(`Invalid toolVersion: ${spec.toolVersion} specified for package ${spec.name}, should look like py36, py3, py36_10`)
    }

    if (spec.type == "condasrc") {
      if (version && version != "-" && packageChannelData.version != version) {
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

      await this._downloadFile(downloadUrl, file.name)
      await this.decompress(file.name, dir.name)
      const hashes = await this.computeHashes(file.name)

      const fetchResult = new FetchResult(request.url)
      fetchResult.document = {
        location: dir.name,
        registryData: { "channelData": packageChannelData },
        releaseDate: new Date(packageChannelData.timestamp).toString(),
        declaredLicenses: packageChannelData.license,
        hashes
      }

      fetchResult.casedSpec = clone(spec)
      request.fetchResult = fetchResult.adoptCleanup(dir, request)
      return request
    } else {
      let repoData = undefined
      if (!(packageChannelData.subdirs.find(x => x == architecture))) {
        return request.markSkip(`Missing architecture ${architecture} in channel`)
      }
      repoData = await this._getRepoData(condaChannels[spec.provider], spec.provider, architecture)

      let packageRepoEntries = Object.entries(repoData.packages)
        .filter(([packageFile, packageData]) => packageData.name == spec.name && ((!version) || version == "-" || version == packageData.version)
          && ((!spec.toolVersion) || packageData.build.startsWith(spec.toolVersion))
        )
        .map(([packageFile, packageData]) => { return { packageFile, packageData } })
        .sort((a, b) => {
          if (a.packageData.build < b.packageData.build) {
            return 1
          } else if (a.packageData.build == b.packageData.build) {
            return 0
          }
          else {
            return -1
          }
        })

      let packageRepoEntry = packageRepoEntries[0]
      if (!packageRepoEntry) {
        return request.markSkip(`Missing package with matching spec ${spec.toString()} in ${architecture} repository`)
      }

      let downloadUrl = new URL(`${condaChannels[spec.provider]}/${architecture}/${packageRepoEntry.packageFile}`).href

      spec.revision = packageRepoEntry.packageData.version + "_" + architecture
      request.url = spec.toUrl()
      super.handle(request)

      const file = this.createTempFile(request)
      const dir = this.createTempDir(request)

      await this._downloadFile(downloadUrl, file.name)
      await this.decompress(file.name, dir.name)
      const hashes = await this.computeHashes(file.name)

      const fetchResult = new FetchResult(request.url)
      fetchResult.document = {
        location: dir.name,
        registryData: { "channelData": packageChannelData, "repoData": packageRepoEntry },
        releaseDate: new Date(packageRepoEntry.packageData.timestamp).toString(),
        declaredLicenses: packageRepoEntry.packageData.license,
        hashes
      }

      fetchResult.casedSpec = clone(spec)

      request.fetchResult = fetchResult.adoptCleanup(dir, request)
      return request
    }
  }

  async _downloadFile(downloadUrl, destination) {
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
