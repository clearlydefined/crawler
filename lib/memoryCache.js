// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Cache = require('memory-cache').Cache

class MemoryCache {
  constructor(options, cache) {
    this._cache = cache
    this.defaultTtlSeconds = options.defaultTtlSeconds
  }

  get(item) {
    return this._cache.get(item)
  }

  set(item, value, afterExpire, ttlSeconds = this.defaultTtlSeconds) {
    const expiration = 1000 * ttlSeconds
    this._cache.put(item, value, expiration, afterExpire)
  }

  setWithConditionalExpiry(item, value, afterExpire = () => {}, shouldExpire = () => true) {
    this.set(item, value, this._onExpire.bind(this, shouldExpire, afterExpire))
  }

  _onExpire(shouldExpire, afterExpire, item, value) {
    if (shouldExpire(item, value)) {
      afterExpire(item, value)
    } else {
      this.set(item, value, this._onExpire.bind(this, shouldExpire, afterExpire))
    }
  }

  delete(item) {
    this._cache.del(item)
  }

  static create(options) {
    return new MemoryCache(options || { defaultTtlSeconds: 60 * 60 }, new Cache())
  }
}

module.exports = MemoryCache