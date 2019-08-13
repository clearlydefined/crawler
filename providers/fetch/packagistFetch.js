// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const requestRetry = require('requestretry').defaults({ maxAttempts: 3, fullResponse: true })
const nodeRequest = require('request')
const fs = require('fs')
const { findLastKey, get, find } = require('lodash')

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
  }

  async _getRegistryData(spec) {
    const baseUrl = providerMap.packagist
    const { body, statusCode } = await requestRetry.get(`${baseUrl}/p/${spec.name}.json`, {
      json: true
    })
    if (statusCode !== 200 || !body) return null
    return body['packages'][spec.name]
  }
}
