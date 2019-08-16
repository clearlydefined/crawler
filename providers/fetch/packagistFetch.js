// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const requestRetry = require('requestretry').defaults({ maxAttempts: 3, fullResponse: true })
const fs = require('fs')
const request = require('request')
// const requestPromise = require('request-promise-native')
const providerMap = {
  packagist: 'https://repo.packagist.org/'
}

class PackagistFetch extends AbstractFetch {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'packagist'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    const registryData = await this._getRegistryData(spec)
    if (!registryData) return this.markSkip(request)
    super.handle(request)
    const file = this.createTempFile(request)
    await this._getPackage(spec, registryData, file.name)
    const dir = this.createTempDir(request)
    await this.decompress(file.name, dir.name)
    const hashes = await this.computeHashes(file.name)
    request.document = this._createDocument(dir, registryData, hashes)
    request.contentOrigin = 'origin'
    return request
  }

  async _getRegistryData(spec) {
    let registryData
    const baseUrl = providerMap.packagist
    const { body, statusCode } = await requestRetry.get(`${baseUrl}/p/${spec.namespace}/${spec.name}.json`, {
      json: true
    })
    if (statusCode !== 200 || !body) return null
    registryData = body
    registryData.manifest = registryData['packages'][`${spec.namespace}/${spec.name}`][`v${spec.revision}`]
    registryData.releaseDate = registryData.manifest['time']
    delete registryData['packages']
    return registryData
  }

  async _getPackage(spec, registryData, destination) {
    return new Promise((resolve, reject) => {
      var options = {
        url: registryData.manifest.dist.url,
        headers: {
          'User-Agent': 'ClearlyDefined'
        }
      }

      request
        .get(options, (error, response) => {
          if (error) return reject(error)
          if (response.statusCode !== 200) reject(new Error(`${response.statusCode} ${response.statusMessage}`))
        })
        .pipe(fs.createWriteStream(destination).on('finish', () => resolve(null)))
    })
  }

  _createDocument(dir, registryData, hashes) {
    const releaseDate = registryData.releaseDate
    return { location: dir.name, registryData, releaseDate, hashes }
  }
}

module.exports = options => new PackagistFetch(options)
