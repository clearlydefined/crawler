// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const { merge } = require('lodash')

class DebSrcExtract extends AbstractClearlyDefinedProcessor {
  get toolVersion() {
    return '1.1.1'
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'clearlydefined' && spec && spec.type == 'debsrc'
  }

  async handle(request) {
    await super.handle(request)
    // Re-arrange these fields to be at the end
    const { releaseDate, registryData, copyrightUrl, declaredLicenses } = request.document
    request.document = merge(this.clone(request.document), { releaseDate, registryData, copyrightUrl, declaredLicenses })
  }
}

module.exports = options => new DebSrcExtract(options)
