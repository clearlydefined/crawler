// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Cache = require('memory-cache').Cache

class MemoryCache {
  constructor(options) {
    this.cache = new Cache()
    this.defaultTtlSeconds = options.defaultTtlSeconds
  }

  get(item) {
    return this.cache.get(item)
  }

  set(item, value, onExpire, ttlSeconds = null) {
    const expiration = 1000 * (ttlSeconds || this.defaultTtlSeconds)
    this.cache.put(item, value, expiration, onExpire)
  }

  delete(item) {
    this.cache.del(item)
  }
}

module.exports = options => new MemoryCache(options || { defaultTtlSeconds: 60 * 60 })