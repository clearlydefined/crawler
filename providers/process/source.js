// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const supportedTypes = ['git', 'sourcearchive']

class SourceProcessor extends BaseHandler {
  get schemaVersion() {
    return 1
  }

  get toolSpec() {
    return { tool: 'cdsourcetraversal', toolVersion: this.schemaVersion }
  }

  shouldFetch() {
    return false
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'source' && spec && supportedTypes.includes(spec.type)
  }

  handle(request) {
    const { document, spec } = super._process(request)
    this.addBasicToolLinks(request, spec)
    this.linkAndQueueTool(request, 'clearlydefined')
    this.linkAndQueueTool(request, 'licensee')
    this.linkAndQueueTool(request, 'fossology')
    this.linkAndQueueTool(request, 'scancode')
    request.markNoSave()
    return document
  }
}

module.exports = { processor: options => new SourceProcessor(options), supportedTypes }
