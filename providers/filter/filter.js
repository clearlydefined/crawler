// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');

class StandardFilter extends BaseHandler {

  constructor(options, processors) {
    super(options);
    this.processors = processors;
  }

  shouldFetchMissing(request, spec) {
    return request.policy.shouldFetchMissing(request)
  }

  shouldFetch(request, spec) {
    return !request.document || this.shouldProcess(request, spec);
  }

  shouldProcess(request, spec) {
    const processor = this._getProcessor(request, this.processors);
    return processor.shouldProcess(request);
  }

  _getProcessor(request) {
    return this.processors.filter(processor => processor.canHandle(request))[0];
  }
}

module.exports = (options, processors) => new StandardFilter(options, processors);