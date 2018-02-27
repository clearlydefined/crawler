// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');

class SourceProcessor extends BaseHandler {

  get schemaVersion() {
    return 1;
  }

  get toolSpec() {
    return { tool: 'cdsourcetraversal', toolVersion: this.schemaVersion };
  }

  shouldFetch(request) {
    return false;
  }

  canHandle(request) {
    const spec = this.toSpec(request);
    return request.type === 'source' && spec && ['git', 'sourcearchive'].includes(spec.type);
  }

  handle(request) {
    const { document, spec } = super._process(request);
    this.addBasicToolLinks(request, spec);
    this.linkAndQueueTool(request, 'clearlydefined');
    this.linkAndQueueTool(request, 'scancode');
    request.markNoSave();
    return document;
  }
}

module.exports = options => new SourceProcessor(options);