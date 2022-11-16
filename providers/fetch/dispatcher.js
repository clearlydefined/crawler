// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const MemoryCache = require('../../lib/memoryCache')

class FetchDispatcher extends AbstractFetch {
  constructor(options, store, fetchers, processors, filter, fetchResultCache, inProgressFetchCache) {
    super(options)
    this.store = store
    this.fetchers = fetchers
    this.processors = processors
    this.filter = filter
    this.fetched = fetchResultCache || MemoryCache.create(options.fetched)
    this.inProgressFetches = inProgressFetchCache || {}
  }

  canHandle() {
    // handle all fetch requests
    return true
  }

  async handle(request) {
    const start = Date.now()
    const processor = this._getProcessor(request)
    if (!processor.shouldFetch(request)) return request.markNoSave()
    const documentKey = processor.getUrnFor(request)
    try {
      const document = await this.store.get(request.type, documentKey)
      if (!document) return this._fetchMissing(request)
      request.addMeta({ read: Date.now() - start })
      request.response = { headers: {} }
      request.document = document
      request.contentOrigin = 'storage'
      return this._dispatchFetch(request)
    } catch (error) {
      // TODO eating the error here. at least log
      return this._fetchMissing(request)
    }
  }

  _getProcessor(request) {
    const processor = this._getHandler(request, this.processors)
    if (!processor) throw new Error(`No processor found for ${request.toString()}`)
    return processor
  }

  async _fetchMissing(request) {
    // The doc could not be loaded from storage. Either storage has failed somehow or this
    // is a new processing path. Decide if we should use the origin store, or skip.
    if (this.filter.shouldFetchMissing(request)) return this._dispatchFetch(request)
    return request.markSkip('Unreachable for reprocessing')
  }

  async _dispatchFetch(request, force = false) {
    if (!force && this.filter && !this.filter.shouldFetch(request)) return request
    // get the right real fetcher for this request and dispatch
    const handler = this._getHandler(request, this.fetchers)
    if (!handler) throw new Error(`No fetcher found for ${request.toString()}`)

    await this._fetchResult(request, handler)
    return request
  }

  async _fetchResult(request, handler) {
    const cacheKey = this.toSpec(request).toUrlPath()
    const fetchResult = this.fetched.get(cacheKey) || await this._fetchPromise(handler, request, cacheKey)
    fetchResult?.decorate(request)
  }

  _fetchPromise(handler, request, cacheKey) {
    return this.inProgressFetches[cacheKey] ||
      (this.inProgressFetches[cacheKey] = this._createFetchPromise(handler, request, cacheKey))
  }

  _createFetchPromise(handler, request, cacheKey) {
    return this._fetch(handler, request, cacheKey)
      .finally(() => delete this.inProgressFetches[cacheKey])
  }

  async _fetch(handler, request, cacheKey) {
    this.logger.debug(`---Start Fetch: ${cacheKey} at ${new Date().toISOString()}`)
    await handler.handle(request)
    const fetchResult = request.fetchResult
    delete request.fetchResult
    if (fetchResult) this._addToCache(cacheKey, fetchResult)

    this.logger.debug(`---End Fetch: ${cacheKey} at ${new Date().toISOString()}`)
    return fetchResult
  }

  _addToCache(cacheKey, fetchResult) {
    this.fetched.setWithConditionalExpiry(
      cacheKey,
      fetchResult,
      this._cleanupResult.bind(this),
      (key, result) => !result.isInUse())
  }

  _cleanupResult(key, result) {
    result.cleanup(error => this.logger.info(`Cleanup  Problem cleaning up after ${key} ${error.message}`))
  }

  // get all the handler that apply to this request from the given list of handlers
  _getHandler(request, list) {
    return list.filter(element => element.canHandle(request))[0]
  }
}

module.exports = (options, store, fetchers, processors, filter, fetchResultCache, inProgressFetchCache) =>
  new FetchDispatcher(options, store, fetchers, processors, filter, fetchResultCache, inProgressFetchCache)
