// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const request = require('request-promise-native')

class WebhookDeltaStore {
  constructor(options) {
    this.options = options
    this.logger = options.logger
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
        this.logger.info(`Failure  Firing webhook failed: ${response.statusCode} ${response.statusMessage}`)
    } catch (error) {
      this.logger.info(`Failure  Firing webhook failed: ${error.message}`)
    }
  }

  get() {
    return null
  }

  etag() {
    return null
  }

  list() {
    return null
  }

  count() {
    return null
  }

  close() {
    return null
  }

  delete() {
    return null
  }
}

module.exports = options => new WebhookDeltaStore(options)
