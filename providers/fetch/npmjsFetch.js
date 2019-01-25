// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const nodeRequest = require('request')
const requestPromise = require('request-promise-native')
const fs = require('fs')
const { clone, get } = require('lodash')

const providerMap = {
  npmjs: 'https://registry.npmjs.com'
}

class NpmFetch extends AbstractFetch {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'npmjs'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    const registryData = await this._getRegistryData(spec)
    if (!registryData) return this.markSkip(request)
    spec.revision = registryData.manifest.version
    // rewrite the request URL as it is used throughout the system to derive locations and urns etc.
    request.url = spec.toUrl()
    super.handle(request)
    const file = this.createTempFile(request)
    await this._getPackage(spec, file.name)
    const dir = this.createTempDir(request)
    await this.decompress(file.name, dir.name)
    const hashes = await this.computeHashes(file.name)
    request.document = this._createDocument(dir, registryData, hashes)
    request.contentOrigin = 'origin'
    const casedSpec = this._getCasedSpec(spec, registryData)
    if (casedSpec) request.casedSpec = casedSpec
    return request
  }

  async _getPackage(spec, destination) {
    return new Promise((resolve, reject) => {
      nodeRequest
        .get(this._buildUrl(spec), (error, response) => {
          if (error) return reject(error)
          if (response.statusCode !== 200) reject(new Error(`${response.statusCode} ${response.statusMessage}`))
        })
        .pipe(fs.createWriteStream(destination).on('finish', () => resolve(null)))
    })
  }

  // query npmjs to get the latest and fullest metadata. Turns out that there is somehow more in the
  // service than in the package manifest in some cases (e.g., lodash).
  async _getRegistryData(spec) {
    // Per https://github.com/npm/registry/issues/45 we should retrieve the whole package and get the version we want from that.
    // The version-specific API (e.g. append /x.y.z to URL) does NOT work for scoped packages.
    const baseUrl = providerMap[spec.provider]
    if (!baseUrl) return null
    const fullName = `${spec.namespace ? spec.namespace + '/' : ''}${spec.name}`
    let registryData
    try {
      registryData = await requestPromise({
        url: `${baseUrl}/${encodeURIComponent(fullName).replace('%40', '@')}`, // npmjs doesn't handle the escaped version
        json: true
      })
    } catch (exception) {
      if (exception.statusCode !== 404) throw exception
      return null
    }
    if (!registryData || !registryData.versions) return null
    const version = spec.revision || this.getLatestVersion(Object.keys(registryData.versions))
    if (!registryData.versions[version]) return null
    const date = registryData.time[version]
    const registryManifest = registryData.versions[version]
    delete registryData.versions
    delete registryData.time
    registryData.manifest = registryManifest
    registryData.releaseDate = date
    return registryData
  }

  _buildUrl(spec) {
    const fullName = spec.namespace ? `${spec.namespace}/${spec.name}` : spec.name
    return `${providerMap[spec.provider]}/${fullName}/-/${spec.name}-${spec.revision}.tgz`
  }

  _createDocument(dir, registryData, hashes) {
    const releaseDate = get(registryData, 'releaseDate')
    return { location: dir.name, registryData, releaseDate, hashes }
  }

  _getCasedSpec(spec, registryData) {
    if (!registryData || !registryData.name) return false
    const parts = registryData.name.split('/')
    const casedSpec = clone(spec)
    switch (parts.length) {
      case 1:
        casedSpec.name = parts[0]
        return casedSpec
      case 2:
        casedSpec.namespace = parts[0]
        casedSpec.name = parts[1]
        return casedSpec
      default:
        return false
    }
  }
}

module.exports = options => new NpmFetch(options)
