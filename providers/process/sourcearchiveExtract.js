// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const { merge } = require('lodash')

class SourceArchiveExtract extends AbstractClearlyDefinedProcessor {

  get toolVersion() {
    return '1.2.0'
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'clearlydefined' && spec?.type === 'sourcearchive'
  }

  async handle(request) {
    await super.handle(request)
    const { summary, poms, releaseDate } = request.document
    const manifest = { summary, poms }
    request.document = merge(this.clone(request.document), { releaseDate, manifest })
  }
}

module.exports = options => new SourceArchiveExtract(options)
