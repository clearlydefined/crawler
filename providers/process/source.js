// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const tmp = require('tmp');

class SourceProcessor {
  getHandler(request, type = request.type) {
    return type === 'source' ? this._process.bind(this) : null;
  }

  _process(request) {
    const document = request.document;
    request.markNoSave();
    if (!request.payload) {
      return document;
    }
    this._addScan(request, 'scancode', 'scancode');
    return document;
  }

  _addScan(request, name, type) {
    const newPolicy = request.getNextPolicy(name);
    request.queue(type, request.url, newPolicy);
  }
}

module.exports = () => new SourceProcessor();