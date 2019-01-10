// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractProcessor = require('../process/abstractProcessor')

class StandardFilter extends AbstractProcessor {
  constructor(options, processors) {
    super(options)
    this.processors = processors
  }

  shouldFetchMissing(request) {
    return request.policy.shouldFetchMissing(request)
  }

  shouldFetch(request, spec) {
    return !request.document || this.shouldProcess(request, spec)
  }

  shouldProcess(request) {
    const processor = this._getProcessor(request, this.processors)
    return processor.shouldProcess(request)
  }

  _getProcessor(request) {
    return this.processors.filter(processor => processor.canHandle(request))[0]
  }
}

module.exports = (options, processors) => new StandardFilter(options, processors)
