// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const request = require('request-promise-native')
const { get } = require('lodash')

class AttachmentStore {
  constructor(options) {
    this.options = options
    this.baseStore = options.baseStore
  }

  connect() {
    return this.baseStore.connect()
  }

  upsert(document) {
    const documentPromise = this.baseStore.upsert(document)
    if (!document._attachments) return documentPromise
    const attachmentPromises = document._attachments.map(entry => {
      return this.baseStore.upsert({
        _metadata: {
          type: 'attachment',
          url: `cd:/attachment/${entry.token}`,
          links: {
            self: {
              href: `urn:attachment:${entry.token}`,
              type: 'resource'
            }
          },
          fetchedAt: get(document, '_metadata.fetchedAt'),
          processedAt: get(document, '_metadata.processedAt'),
          version: '1'
        },
        attachment: Buffer.from(entry.attachment).toString()
      })
    })
    attachmentPromises.push(documentPromise)
    return Promise.all(attachmentPromises)
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

module.exports = options => new AttachmentStore(options)
