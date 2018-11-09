// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const supportedTypes = ['npm', 'crate', 'maven', 'nuget', 'gem', 'pypi']

class PackageProcessor extends BaseHandler {
  get schemaVersion() {
    return 1
  }

  get toolSpec() {
    return { tool: 'cdpackagetraversal', toolVersion: this.schemaVersion }
  }

  shouldFetch() {
    return false
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'package' && spec && supportedTypes.includes(spec.type)
  }

  handle(request) {
    const { spec } = super._process(request)
    this.addBasicToolLinks(request, spec)
    this.linkAndQueueTool(request, spec.type)
    request.markNoSave()
    return request
  }
}

module.exports = { processor: options => new PackageProcessor(options), supportedTypes }
