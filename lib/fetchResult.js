// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { cloneDeep } = require('lodash')

/**
 * @property {(() => void)[]} _cleanups
 * @property {Record<string, any>} _meta
 * @property {any[]} _dependents
 */
class FetchResult {
  /** @param {string} [url] */
  constructor(url) {
    this.contentOrigin = 'origin'
    if (url) {
      this.url = url
    }
    /** @type {(() => void)[]} */
    this._cleanups = []
    /** @type {Record<string, any>} */
    this._meta = {}
    /** @type {any[]} */
    this._dependents = []
    //make sure these are not enumerable
    Object.defineProperty(this, '_cleanups', { value: this._cleanups, enumerable: false, configurable: false })
    Object.defineProperty(this, '_meta', { value: this._meta, enumerable: false, configurable: false })
    Object.defineProperty(this, '_dependents', {
      value: this._dependents,
      writable: true,
      enumerable: false,
      configurable: false
    })
  }

  /** @param {(() => void) | (() => void)[]} cleanups */
  trackCleanup(cleanups) {
    if (!cleanups) {
      return this
    }
    const cleanupCallbacks = Array.isArray(cleanups) ? cleanups : [cleanups]
    this._cleanups.push(...cleanupCallbacks)
    return this
  }

  /**
   * @param {{ removeCallback?: () => void } | { removeCallback?: () => void }[]} needCleanup
   * @param {{ removeCleanup?(cleanups: (() => void)[]): void }} [fromRequest]
   */
  adoptCleanup(needCleanup, fromRequest) {
    if (!needCleanup) {
      return this
    }
    const cleanups = (Array.isArray(needCleanup) ? needCleanup : [needCleanup])
      .map(toCleanup => toCleanup.removeCallback)
      .filter(item => item)
    //transfer the clean up from request to fetchResult
    this.trackCleanup(cleanups)
    fromRequest?.removeCleanup(cleanups)
    return this
  }

  /** @param {((error: Error) => void)} [errorHandler] */
  cleanup(errorHandler) {
    this._cleanups.forEach(
      /** @param {() => void} cleanup */ cleanup => {
        try {
          cleanup()
        } catch (error) {
          errorHandler?.(/** @type {Error} */ (error))
        }
      }
    )
  }

  /** @param {Record<string, any>} data */
  addMeta(data) {
    Object.assign(this._meta, data)
    return this
  }

  /** @param {any} request */
  copyTo(request) {
    Object.assign(request, cloneDeep(this))
    if (Object.keys(this._meta).length) {
      request.addMeta?.(cloneDeep(this._meta))
    }
  }

  /** @param {...any} dependents */
  trackDependents(...dependents) {
    this._dependents.push(...dependents)
    return this
  }

  /** @param {...any} toRemove */
  removeDependents(...toRemove) {
    this._dependents = this._dependents.filter(/** @param {any} item */ item => !toRemove.includes(item))
    return this
  }

  isInUse() {
    return this._dependents.length > 0
  }

  /** @param {any} request */
  decorate(request) {
    this.copyTo(request)
    this.trackDependents(request)
    request.trackCleanup(() => this.removeDependents(request))
  }
}

module.exports = FetchResult
