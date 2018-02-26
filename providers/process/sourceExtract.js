// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class SourceExtract extends BaseHandler {

  get schemaVersion() {
    return 1;
  }

  get toolSpec() {
    return { tool: 'clearlydefined', toolVersion: this.schemaVersion };
  }

  canHandle(request) {
    const spec = this.toSpec(request);
    return request.type === 'clearlydefined' && spec && ['git', 'sourcearchive'].includes(spec.type);
  }

  async handle(request) {
    const { document, spec } = super._process(request);
    this.addBasicToolLinks(request, spec);
    const clearlyFile = path.join(request.document.location, 'clearly.yaml');
    const result = {
      _metadata: document._metadata,
      releaseDate: request.document.releaseDate
    }
    if (!fs.existsSync(clearlyFile))
      return result;
    const content = await promisfy(fs.readFileSync)(clearlyFile);
    result.description = yaml.safeLoad(content);
    return result;
  }
}

module.exports = options => new SourceExtract(options);