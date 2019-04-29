// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')

class DpkgFetch extends AbstractFetch {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'dpkg'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    if (this.options.disabled) return this.queueSpecific(request, spec)
    throw new Error('DpkgFetch is not implemented')
  }
}

module.exports = options => new DpkgFetch(options)
