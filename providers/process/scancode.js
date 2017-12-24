// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const tmp = require('tmp');

class ScanCodeProcessor {

  constructor(options) {
    this.options = options;
    this.logger = options.logger;
  }

  getHandler(request, type = request.type) {
    return type === 'scancode' ? this._scan.bind(this) : null;
  }

  _scan(request) {
    const document = request.document;
    request.addRootSelfLink(this._getConfigurationId());
    const dir = this._createTempLocation(request);
    this.logger.info(`Running ScanCode on ${request.document.location} with output going to ${dir.name}`);
    document.output = dir.name;

    // TODO really run the scan here
    return new Promise((resolve, reject) => {
      require('fs').appendFile(document.output, 'this is some scancode output', error => {
        error ? reject(error) : resolve(document);
      });
    });
  }

  _createTempLocation(request) {
    const result = tmp.fileSync({ unsafeCleanup: true, prefix: 'cd-' });
    request.trackCleanup(result.removeCallback);
    return result;
  }

  _getConfigurationId() {
    return `scancode--${this._getVersion()}`;
  }

  _getVersion() {
    // TODO get the real version of the configured tool
    return '1';
  }
}

module.exports = options => new ScanCodeProcessor(options);