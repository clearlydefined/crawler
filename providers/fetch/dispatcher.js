// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');

class FetchDispatcher extends BaseHandler {

  constructor(options, store, fetchers, processors, filter) {
    super(options);
    this.store = store;
    this.fetchers = fetchers;
    this.processors = processors;
    this.filter = filter;
  }

  canHandle(request) {
    // handle all fetch requests
    return true;
  }

  async handle(request) {
    const start = Date.now();
    try {
      const processor = this._getProcessor(request);
      if (!processor.shouldFetch(request))
        return request.markNoSave();
      const documentKey = processor.getUrnFor(request);
      const document = await this.store.get(request.type, documentKey);
      if (!document)
        return this._fetchMissing(request);
      request.addMeta({ read: Date.now() - start });
      request.response = { headers: {} };
      request.document = document;
      request.contentOrigin = 'storage';
      return this._dispatchFetch(request);
    } catch (erorr) {
      // TODO eating the error here. at least log
      return this._fetchMissing(request);
    }
  }

  _getProcessor(request) {
    const processors = this._getHandlers(request, this.processors);
    if (processors.length !== 1)
      throw new Error(`Wrong number of processors for ${request.toString()}: ${processors.length}`);
    return processors[0];
  }

  async _fetchMissing(request) {
    // The doc could not be loaded from storage. Either storage has failed somehow or this
    // is a new processing path. Decide if we should use the origin store, or skip.
    if (this.filter.shouldFetchMissing(request))
      return this._dispatchFetch(request);
    return request.markSkip('Unreachable for reprocessing');
  }

  async _dispatchFetch(request, force = false) {
    if (!force && this.filter && !this.filter.shouldFetch(request))
      return request;
    // get the right real fetcher(s) for this request and dispatch
    const handlers = this._getHandlers(request, this.fetchers);
    return Promise.all(handlers.map(fetcher => fetcher.handle(request)))
      .then(results => request);
  }

  // get all the handlers that apply to this request
  _getHandlers(request, list) {
    return list.filter(element => element.canHandle(request));
  }
}

module.exports = (options, store, fetchers, processors, filter) => new FetchDispatcher(options, store, fetchers, processors, filter);