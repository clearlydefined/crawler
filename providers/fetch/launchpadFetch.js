// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// Copyright (c) 2018, The Linux Foundation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const requestRetry = require('requestretry').defaults({ maxAttempts: 3, fullResponse: true })
const nodeRequest = require('request')
const fs = require('fs')
const { findLastKey, get, find } = require('lodash')

const providerMap = {
  launchpad: 'https://api.launchpad.net/1.0/'
}
class LaunchpadFetch extends BaseHandler {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'launchpad'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    const registryData = await this._getRegistryData(spec)
    const revisionData = spec.revision ? await this._getRevision(spec) : null
    request.url = spec.toUrl()
    const file = this._createTempFile(request)
    await this._getPackage(spec, revisionData, file.name)
    const dir = this._createTempDir(request)
    await this.decompress(file.name, dir.name)
    request.document = await this._createDocument(dir, spec, registryData, revisionData)
    request.contentOrigin = 'origin'
    return request
  }

  async _getRegistryData(spec) {
    const baseUrl = providerMap.launchpad
    const { body, statusCode } = await requestRetry.get(`${baseUrl}${spec.name}`, {
      json: true
    })
    if (statusCode !== 200 || !body) return null
    return body
  }

  async _getRevision(spec) {
    const baseUrl = providerMap.launchpad
    // need to paginate the call below
    const { body, statusCode } = await requestRetry.get(`${baseUrl}${spec.name}/releases`, {
      json: true
    })
    if (statusCode !== 200 || !body) return null
    const release = find(body.entries, entry => {
      return entry.version === spec.revision
    })
    // This won't work unless I can pass in a series and a release via the URL
    //const { body, statusCode } = await requestRetry.get(`${baseUrl}${spec.name}/${spec.series}/${spec.revision}`);
    //if (statusCode !== 200 || !body) return null
    //return body
    return release
  }

  _createDocument(dir, spec, registryData, revisionData) {
    const releaseDate = this._extractReleaseDate(revisionData)
    return { location: dir.name, registryData, revisionData, releaseDate }
  }

  _extractReleaseDate(revisionData) {
    return revisionData ? revisionData.date_released : null
  }

  async _getPackage(spec, revisionData, destination) {
    // sometimes a "revision" seems to have multiple releases, but I think that is just some cases of
    // how teams are managing their packages and not standard, not sure wheter to return them all?
    const { body, statusCode } = await requestRetry.get(revisionData.files_collection_link, {
      json: true
    })
    if (statusCode !== 200 || !body) return null
    const releases = body.entries.filter(entry => entry.file_type === 'Code Release Tarball')
    if (!releases) return
    // Just take the first one for now, not sure what to do with multiple files
    const release = releases[0]
    return new Promise((resolve, reject) => {
      nodeRequest
        .get(release.file_link, (error, response) => {
          if (error) return reject(error)
          if (response.statusCode !== 200) reject(new Error(`${response.statusCode} ${response.statusMessage}`))
        })
        .pipe(fs.createWriteStream(destination).on('finish', () => resolve(null)))
    })
  }
}

module.exports = options => new LaunchpadFetch(options)
