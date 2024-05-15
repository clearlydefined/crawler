// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { pick } = require('lodash')
const { callFetch } = require('../../lib/fetch')

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
      responseType: 'json',
      body: pick(document, '_metadata'),
      headers: {
        'x-crawler': this.options.token || 'secret'
      },
      resolveWithFullResponse: true
    }
    try {
      const response = await callFetch(options)
      if (response.status !== 200)
        this.logger.info(`Failure  Firing webhook failed: ${response.status} ${response.statusText}`)
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
