// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractProcessor = require('./abstractProcessor')

const supportedTypes = ['npm', 'crate', 'maven', 'nuget', 'gem', 'pod', 'pypi', 'composer', 'deb']

class PackageProcessor extends AbstractProcessor {
  shouldFetch() {
    return false
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'package' && spec && supportedTypes.includes(spec.type)
  }

  handle(request) {
    super.handle(request)
    const spec = this.toSpec(request)
    this.linkAndQueueTool(request, spec.type)
    request.markNoSave()
    return request
  }
}

module.exports = { processor: options => new PackageProcessor(options), supportedTypes }
