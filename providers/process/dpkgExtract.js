// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')

class DpkgExtract extends AbstractClearlyDefinedProcessor {
  get toolVersion() {
    return '1.0.0'
  }

  get toolName() {
    return 'dpkg'
  }

  canHandle(request) {
    return request.type === 'dpkg'
  }

  async handle(request) {
    super.handle(request)
    throw new Error('DpkgExtract is not implemented')
  }
}

module.exports = options => new DpkgExtract(options)
