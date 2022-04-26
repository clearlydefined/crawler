// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractProcessor = require('./abstractProcessor')
const supportedTypes = ['git', 'sourcearchive', 'debsrc']

class SourceProcessor extends AbstractProcessor {
  shouldFetch() {
    return false
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'source' && spec && supportedTypes.includes(spec.type)
  }

  handle(request) {
    super.handle(request)
    this.linkAndQueueTool(request, 'clearlydefined')
    this.linkAndQueueTool(request, 'licensee')
    // this.linkAndQueueTool(request, 'fossology')
    this.linkAndQueueTool(request, 'scancode')
    this.linkAndQueueTool(request, 'reuse')
    request.markNoSave()
    return request
  }
}

module.exports = { processor: options => new SourceProcessor(options), supportedTypes }
