// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

class InmemoryDocStore {
  constructor() {
    this.collections = {}
  }

  async connect() {
    return null
  }

  async upsert(document) {
    const type = document._metadata.type
    const url = document._metadata.url
    const urn = document._metadata.links.self.href
    let collection = this.collections[type]
    if (!collection) {
      collection = {}
      this.collections[type] = collection
    }
    collection[url] = document
    collection[urn] = document
    return document
  }

  async get(type, key) {
    const collection = this.collections[type]
    if (!collection) {
      return Promise.reject()
    }
    return collection[key] ? collection[key] : Promise.reject()
  }

  async etag(type, key) {
    const collection = this.collections[type]
    if (!collection) {
      return null
    }
    let result = collection[key]
    result = result ? result._metadata.etag : null
    return result
  }

  async list(type) {
    let collection = this.collections[type]
    if (!collection) {
      collection = {}
    }
    return Object.keys(collection)
      .filter(key => {
        return key.startsWith('urn:') ? true : false
      })
      .map(key => {
        const metadata = collection[key]._metadata
        return {
          version: metadata.version,
          etag: metadata.etag,
          type: metadata.type,
          url: metadata.url,
          urn: metadata.links.self.href,
          fetchedAt: metadata.fetchedAt,
          processedAt: metadata.processedAt,
          extra: metadata.extra
        }
      })
  }

  async delete(type, key) {
    const collection = this.collections[type]
    if (!collection) {
      return null
    }
    const document = collection[key]
    if (document) {
      const anotherKey = key === document._metadata.url ? document._metadata.links.self.href : document._metadata.url
      delete collection[anotherKey]
    }
    delete collection[key]
    return true
  }

  async count(type) {
    const results = await this.list(type)
    return results.length
  }

  close() {
    this.collections = {}
  }
}

module.exports = options => new InmemoryDocStore(options)
