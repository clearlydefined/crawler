// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const request = require('request-promise-native')
const { get } = require('lodash')

class HashedContentStore {
  constructor(options) {
    this.options = options
    this.baseStore = options.baseStore
  }

  connect() {
    return this.baseStore.connect()
  }

  upsert(document) {
    if (!document._fileContent) return
    return Promise.all(
      document._fileContent.map(entry => {
        return this.baseStore.upsert({
          _metadata: {
            type: 'content',
            url: `cd:/content/${entry.token}`,
            links: {
              self: {
                href: `urn:content:${entry.token}`,
                type: 'resource'
              }
            },
            fetchedAt: get(document, '_metadata.fetchedAt'),
            processedAt: get(document, '_metadata.processedAt'),
            version: '1'
          },
          content: Buffer.from(entry.content).toString()
        })
      })
    )
  }

  get(type, key) {
    return this.baseStore.get(type, key)
  }

  etag(type, key) {
    return this.baseStore.etag(type, key)
  }

  list(type) {
    return this.baseStore.list(type)
  }

  count(type) {
    return this.baseStore.count(type)
  }

  close() {
    return this.baseStore.close()
  }

  delete(type, key) {
    return this.baseStore.delete(type, key)
  }
}

module.exports = options => new HashedContentStore(options)
