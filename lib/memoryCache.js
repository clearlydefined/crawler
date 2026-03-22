// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const Cache = require('memory-cache').Cache

class MemoryCache {
  /**
   * @param {{ defaultTtlSeconds: number }} options
   * @param {any} cache
   */
  constructor(options, cache) {
    this._cache = cache
    this.defaultTtlSeconds = options.defaultTtlSeconds
  }

  /** @param {string} item */
  get(item) {
    return this._cache.get(item)
  }

  /**
   * @param {string} item
   * @param {any} value
   * @param {((key: string, value: any) => void)} [afterExpire]
   * @param {number} [ttlSeconds]
   */
  set(item, value, afterExpire, ttlSeconds = this.defaultTtlSeconds) {
    const expiration = 1000 * ttlSeconds
    this._cache.put(item, value, expiration, afterExpire)
  }

  /**
   * @param {string} item
   * @param {any} value
   * @param {(key: string, value: any) => void} [afterExpire]
   * @param {(key: string, value: any) => boolean} [shouldExpire]
   */
  setWithConditionalExpiry(item, value, afterExpire = () => {}, shouldExpire = () => true) {
    this.set(item, value, this._onExpire.bind(this, shouldExpire, afterExpire))
  }

  /**
   * @param {(key: string, value: any) => boolean} shouldExpire
   * @param {(key: string, value: any) => void} afterExpire
   * @param {string} item
   * @param {any} value
   */
  _onExpire(shouldExpire, afterExpire, item, value) {
    if (shouldExpire(item, value)) {
      afterExpire(item, value)
    } else {
      this.set(item, value, this._onExpire.bind(this, shouldExpire, afterExpire))
    }
  }

  /** @param {string} item */
  delete(item) {
    this._cache.del(item)
  }

  /** @param {{ defaultTtlSeconds: number }} [options] */
  static create(options) {
    return new MemoryCache(options || { defaultTtlSeconds: 60 * 60 }, new Cache())
  }
}

module.exports = MemoryCache
