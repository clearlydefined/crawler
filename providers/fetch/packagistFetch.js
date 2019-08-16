// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const requestRetry = require('requestretry').defaults({ maxAttempts: 3, fullResponse: true })
// const fs = require('fs')
// const { findLastKey, get, find } = require('lodash')

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

    console.log(registryData)
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
}

module.exports = options => new PackagistFetch(options)
