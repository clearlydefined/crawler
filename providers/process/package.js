// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');

class PackageProcessor extends BaseHandler {

  get schemaVersion() {
    return 1;
  }

  get toolSpec() {
    return { tool: 'cdpackagetraversal', toolVersion: this.schemaVersion };
  }

  shouldFetch(request) {
    return false;
  }

  canHandle(request) {
    const spec = this.toSpec(request);
    return request.type === 'package' && spec && ['npm', 'maven'].includes(spec.type);
  }

  handle(request) {
    const { document, spec } = super._process(request);
    this.addBasicToolLinks(request, spec);
    this.linkAndQueueTool(request, spec.type);
    request.markNoSave();
    return request;
  }
}

module.exports = options => new PackageProcessor(options);