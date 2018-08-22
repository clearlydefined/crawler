// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')

class SourceProcessor extends BaseHandler {
  get schemaVersion() {
    return 1
  }

  get toolSpec() {
    return { tool: 'cdsourcetraversal', toolVersion: this.schemaVersion }
  }

  shouldFetch(request) {
    return false
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'source' && spec && ['git', 'sourcearchive'].includes(spec.type)
  }

  handle(request) {
    const document = super._process(request)
    const spec = this.toSpec()
    this.addBasicToolLinks(request, spec)
    this.linkAndQueueTool(request, spec, 'clearlydefined')
    this.linkAndQueueTool(request, spec, 'scancode')
    this.linkAndQueueTool(request, spec, 'fossology')
    request.markNoSave()
    return document
  }
}

module.exports = options => new SourceProcessor(options)
