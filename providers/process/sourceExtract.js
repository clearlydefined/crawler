// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const { promisify } = require('util')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const { merge } = require('lodash')

class SourceExtract extends AbstractClearlyDefinedProcessor {
  get schemaVersion() {
    return '1.1.0'
  }

  get toolSpec() {
    return { tool: 'clearlydefined', toolVersion: this.schemaVersion }
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'clearlydefined' && spec && ['git', 'sourcearchive'].includes(spec.type)
  }

  async handle(request) {
    await super.handle(request)
    const location = request.document.location
    request.document = merge(this.clone(request.document), { releaseDate: request.document.releaseDate })
    const clearlyFile = path.join(location, 'clearly.yaml')
    if (!fs.existsSync(clearlyFile)) return
    const content = await promisify(fs.readFileSync)(clearlyFile)
    request.document.description = yaml.safeLoad(content)
  }
}

module.exports = options => new SourceExtract(options)
