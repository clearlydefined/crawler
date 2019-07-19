// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const fs = require('fs')
const nodeRequest = require('request')
const requestPromise = require('request-promise-native')
const { clone } = require('lodash')

const providerMap = {
  debian: 'http://ftp/debian.org/debian/'
}

class DebianFetch extends AbstractFetch {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'debian'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    if (!spec.revision) spec.revision = await this._getLatestVersion(spec)
    if (!spec.revision) return request.markSkip('Missing  ')
    request.url = spec.toUrl()
    super.handle(request)
    const registryData = await this._getRegistryData(spec)
    const file = this.createTempFile(request)
    await this._getPackage(spec, registryData, file.name) // TODO
    const dir = this.createTempDir(request)
    await this.decompress(file.name, dir.name)
    // the decompressed folder should contain control.tar.xz, data.tar.xz, debian-binary. The package is in data.tar.xz
    const hashes = await this.computeHashes(file.name)
    let releaseDate = null // TODO: get file date!
    request.document = await this._createDocument(dir, registryData, releaseDate, hashes) // TODO
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
    // TODO: get and parse cached/uncached indices
    // The function should return package and source data location incl. patches
  }

  async _getPackage(spec, registryData, destination) {
    const isSrc = spec.type === 'debsrc'
    // TODO
    return new Promise((resolve, reject) => {
      nodeRequest
        .get(this._buildUrl(spec, registryData), (error, response) => {
          if (error) return reject(error)
          if (response.statusCode !== 200) reject(new Error(`${response.statusCode} ${response.statusMessage}`))
        })
        .pipe(fs.createWriteStream(destination).on('finish', () => resolve(null)))
    })
  }

  // TODO
  _buildUrl(spec, { binaryPath }) {
    // TODO: find location
    const packagePath = 'pool/main/2/2048-qt/2048-qt_0.1.6-2_arm64.deb'
    return `${providerMap.debian}/${packagePath}`
  }
}

module.exports = options => new DebianFetch(options)
