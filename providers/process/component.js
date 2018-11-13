// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const SourceProcessor = require('./source')
const PackageProcessor = require('./package')

class ComponentProcessor extends BaseHandler {
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
    return request.type === 'component'
  }

  handle(request) {
    const { document, spec } = super._process(request)
    this.addBasicToolLinks(request, spec)
    if (SourceProcessor.supportedTypes.includes(spec.type)) this.linkAndQueueTool(request, 'source')
    else if (PackageProcessor.supportedTypes.includes(spec.type)) this.linkAndQueueTool(request, 'package')
    request.markNoSave()
    return document
  }
}

module.exports = options => new ComponentProcessor(options)
