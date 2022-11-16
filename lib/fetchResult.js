// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { cloneDeep } = require('lodash')

class FetchResult {

  constructor(url) {
    this.contentOrigin = 'origin'
    if (url) this.url = url
    //make sure these are not enumerable
    Object.defineProperty(this, '_cleanups', { value: [] })
    Object.defineProperty(this, '_meta', { value: {} })
    Object.defineProperty(this, '_dependents', { value: [], writable: true })
  }

  trackCleanup(cleanups) {
    if (!cleanups) return this
    const cleanupCallbacks = Array.isArray(cleanups) ? cleanups : [cleanups]
    this._cleanups.push(...cleanupCallbacks)
    return this
  }

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

  cleanup(errorHandler) {
    this._cleanups.forEach(cleanup => {
      try {
        cleanup()
      } catch (error) {
        errorHandler?.(error)
      }
    })
  }

  addMeta(data) {
    Object.assign(this._meta, data)
    return this
  }

  copyTo(request) {
    Object.assign(request, cloneDeep(this))
    if (Object.keys(this._meta).length) request.addMeta?.(cloneDeep(this._meta))
  }

  trackDependents(...dependents) {
    this._dependents.push(...dependents)
    return this
  }

  removeDependents(...toRemove) {
    this._dependents = this._dependents.filter(item => !toRemove.includes(item))
    return this
  }

  isInUse() {
    return this._dependents.length > 0
  }

  decorate(request) {
    this.copyTo(request)
    this.trackDependents(request)
    request.trackCleanup(() => this.removeDependents(request))
  }
}

module.exports = FetchResult