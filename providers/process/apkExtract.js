// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')

class ApkExtract extends AbstractClearlyDefinedProcessor {
  get toolVersion() {
    return '1.0.0'
  }

  get toolName() {
    return 'apk'
  }

  canHandle(request) {
    return request.type === 'apk'
  }

  async handle(request) {
    super.handle(request)
    throw new Error('ApkExtract is not implemented')
  }
}

module.exports = options => new ApkExtract(options)
