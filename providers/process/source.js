// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');

class SourceProcessor extends BaseHandler {

  get schemaVersion() {
    return 1;
  }

  get toolSpec() {
    return { tool: 'clearlydescribed', toolVersion: 1 };
  }

  getHandler(request, type = request.type) {
    const spec = this.toSpec(request);
    // if there is no tool and it is a source related request, it's for us
    return (!spec.tool && ['git'].includes(type)) ? this._process.bind(this) : null;
  }

  _process(request) {
    const { document, spec } = super._process(request);
    this.addBasicToolLinks(request, spec);
    this.linkAndQueueTool(request, 'scancode', 'scancode');
    return document;
  }
}

module.exports = options => new SourceProcessor(options);