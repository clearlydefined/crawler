// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractProcessor = require('./abstractProcessor')
const SourceProcessor = require('./source')
const PackageProcessor = require('./package')

class ComponentProcessor extends AbstractProcessor {
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
    super.handle(request)
    const spec = this.toSpec(request)
    if (SourceProcessor.supportedTypes.includes(spec.type)) this.linkAndQueueTool(request, 'source')
    else if (PackageProcessor.supportedTypes.includes(spec.type)) this.linkAndQueueTool(request, 'package')
    request.markNoSave()
    return request
  }
}

module.exports = options => new ComponentProcessor(options)
