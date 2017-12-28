// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');

class ScanCodeProcessor extends BaseHandler {

  get schemaVersion() {
    return 1;
  }

  get toolVersion() {
    return 1;
  }

  getHandler(request) {
    const spec = this.toSpec(request);
    return spec && spec.tool === 'scancode' ? this._process.bind(this) : null;
  }

  _process(request) {
    const { document, spec } = super._process(request);
    this.addSelfLink(request, this._getUrn(spec));
    this.linkToolResult(request, spec.toUrn());
    const file = this._createTempFile(request);
    document._metadata.contentLocation = file.name;
    document._metadata.contentType = 'application/json';
    this.logger.info(`Running ScanCode on ${request.document.location} with output going to ${file.name}`);

    // TODO really run the scan here
    return new Promise((resolve, reject) => {
      const output = require('../../scancodeSample.json');
      require('fs').appendFile(file.name, JSON.stringify(output), error => {
        error ? reject(error) : resolve(document);
      });
    });
  }

  _getUrn(spec) {
    const newSpec = Object.assign(Object.create(spec), spec, { tool: 'scancode', toolVersion: this.toolVersion });
    return newSpec.toUrn();
  }
}

module.exports = options => new ScanCodeProcessor(options);