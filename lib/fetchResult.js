// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

class FetchResult {

  constructor() {
    this.contentOrigin = 'origin'
    //make sure these are not enumerable
    Object.defineProperty(this, '_cleanups', { value: [] })
    Object.defineProperty(this, '_meta', { value: {} })
  }

  trackCleanup(cleanups) {
    if (!cleanups) return this
    const cleanupCallbacks = Array.isArray(cleanups) ? cleanups : [cleanups]
    this._cleanups.push(...cleanupCallbacks)
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
    Object.assign(request, this)
    if (Object.keys(this._meta).length) request.addMeta?.(this._meta)
  }
}

module.exports = FetchResult