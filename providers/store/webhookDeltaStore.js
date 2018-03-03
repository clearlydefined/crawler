// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const request = require('request-promise-native')

class WebhookDeltaStore {
  constructor(options, baseStore) {
    this.options = options
    this.baseStore = baseStore
  }

  connect() {
    return null
  }

  async upsert(document) {
    const uri = this.options.url
    var options = {
      method: 'POST',
      uri,
      json: true,
      body: document,
      headers: {
        'x-crawler': this.options.token || 'secret'
      },
      resolveWithFullResponse: true
    }
    try {
      const response = await request(options)
      if (response.statusCode !== 200)
        this.options.logger.info(`Failure  Firing webhook failed: ${response.statusCode} ${response.statusMessage}`)
    } catch (error) {
      this.options.logger.info(`Failure  Firing webhook failed: ${error.message}`)
    }
  }

  get(type, key) {
    return null
  }

  etag(type, key) {
    return null
  }

  list(type) {
    return null
  }

  count(type) {
    return null
  }

  close() {
    return null
  }

  delete(type, key) {
    return null
  }
}

module.exports = options => new WebhookDeltaStore(options)
