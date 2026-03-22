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
    if (url) this.url = url
    //make sure these are not enumerable
    Object.defineProperty(this, '_cleanups', { value: /** @type {(() => void)[]} */ ([]) })
    Object.defineProperty(this, '_meta', { value: /** @type {Record<string, any>} */ ({}) })
    Object.defineProperty(this, '_dependents', { value: /** @type {any[]} */ ([]), writable: true })
  }

  /** @param {(() => void) | (() => void)[]} cleanups */
  trackCleanup(cleanups) {
    if (!cleanups) return this
    /** @type {any} */
    const self = this
    const cleanupCallbacks = Array.isArray(cleanups) ? cleanups : [cleanups]
    self._cleanups.push(...cleanupCallbacks)
    return this
  }

  /**
   * @param {{ removeCallback?: () => void } | { removeCallback?: () => void }[]} needCleanup
   * @param {{ removeCleanup?(cleanups: (() => void)[]): void }} [fromRequest]
   */
  adoptCleanup(needCleanup, fromRequest) {
    if (!needCleanup) return this
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
    /** @type {any} */
    const self = this
    self._cleanups.forEach(
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
    /** @type {any} */
    const self = this
    Object.assign(self._meta, data)
    return this
  }

  /** @param {any} request */
  copyTo(request) {
    /** @type {any} */
    const self = this
    Object.assign(request, cloneDeep(this))
    if (Object.keys(self._meta).length) request.addMeta?.(cloneDeep(self._meta))
  }

  /** @param {...any} dependents */
  trackDependents(...dependents) {
    /** @type {any} */
    const self = this
    self._dependents.push(...dependents)
    return this
  }

  /** @param {...any} toRemove */
  removeDependents(...toRemove) {
    /** @type {any} */
    const self = this
    self._dependents = self._dependents.filter(/** @param {any} item */ item => !toRemove.includes(item))
    return this
  }

  isInUse() {
    /** @type {any} */
    const self = this
    return self._dependents.length > 0
  }

  /** @param {any} request */
  decorate(request) {
    this.copyTo(request)
    this.trackDependents(request)
    request.trackCleanup(() => this.removeDependents(request))
  }
}

module.exports = FetchResult
