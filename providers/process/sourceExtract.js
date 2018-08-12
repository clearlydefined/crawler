// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const { promisify } = require('util')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

class SourceExtract extends BaseHandler {
  get schemaVersion() {
    return 1
  }

  get toolSpec() {
    return { tool: 'clearlydefined', toolVersion: this.schemaVersion }
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'clearlydefined' && spec && ['git', 'sourcearchive'].includes(spec.type)
  }

  async handle(request) {
    const { document, spec } = super._process(request)
    this.addBasicToolLinks(request, spec)
    const location = request.document.location
    request.document = {
      _metadata: document._metadata,
      releaseDate: request.document.releaseDate
    }
    await BaseHandler.addInterestingFiles(request.document, location)
    const clearlyFile = path.join(location, 'clearly.yaml')
    if (!fs.existsSync(clearlyFile)) return
    const content = await promisfy(fs.readFileSync)(clearlyFile)
    request.document.description = yaml.safeLoad(content)
  }
}

module.exports = options => new SourceExtract(options)
