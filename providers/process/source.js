// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');

class SourceProcessor extends BaseHandler {

  get schemaVersion() {
    return 1;
  }

  get toolSpec() {
    return { tool: 'clearlydescribed', toolVersion: this.schemaVersion };
  }

  shouldFetch(request) {
    return false;
  }

  canHandle(request) {
    const spec = this.toSpec(request);
    return request.type === 'source' && spec && ['git', 'maven-source'].includes(spec.type);
  }

  handle(request) {
    const { document, spec } = super._process(request);
    this.addBasicToolLinks(request, spec);
    this.linkAndQueueTool(request, 'scancode');
    return document;
  }
}

module.exports = options => new SourceProcessor(options);