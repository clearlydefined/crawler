// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const { promisify } = require('util')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const { merge } = require('lodash')

class SourceExtract extends AbstractClearlyDefinedProcessor {
  get toolVersion() {
    return '1.1.0'
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'clearlydefined' && spec && ['git', 'sourcearchive', 'debsrc'].includes(spec.type)
  }

  async handle(request) {
    await super.handle(request)
    const location = request.document.location
    const registryData = request.document.registryData
    request.document = merge(this.clone(request.document), { releaseDate: request.document.releaseDate })
    if (registryData) {
      request.document.registryData = registryData
    }
    const clearlyFile = path.join(location, 'clearly.yaml')
    if (!fs.existsSync(clearlyFile)) return
    const content = await promisify(fs.readFileSync)(clearlyFile)
    request.document.description = yaml.safeLoad(content)
  }
}

module.exports = options => new SourceExtract(options)
