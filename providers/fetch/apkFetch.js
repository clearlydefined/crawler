// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')

class ApkFetch extends AbstractFetch {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'apk'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    if (this.options.disabled) return this.queueSpecific(request, spec)
    throw new Error('ApkFetch is not implemented')
  }
}

module.exports = options => new ApkFetch(options)
