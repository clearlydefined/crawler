// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const decompress = require('decompress');
const fs = require('fs');
const nodeRequest = require('request');
const path = require('path');

let _toolVersion = '2.2.1'; // TODO

class VstsProcessor extends BaseHandler {

  constructor(options) {
    super(options);
    // TODO little questionable here. Kick off an async operation on load with the expecation that
    // by the time someone actually uses this instance, the call will have completed.
    // Need to detect the tool version before anyone tries to run this processor.
    // this._detectVersion();
  }

  get schemaVersion() {
    return _toolVersion;
  }

  get toolSpec() {
    return { tool: 'scancode', toolVersion: this.schemaVersion };
  }

  get authToken() {
    return 'Basic ' + new Buffer(this.options.apiToken + ':', 'utf8').toString('base64'); // TODO
  }

  canHandle(request) {
    return request.type === 'ingest-vsts';
  }

  async handle(request) {
    const { document, spec } = super._process(request);
    this.addBasicToolLinks(request, spec);
    this.logger.info(`Processing ${request.toString()}`);
    const file = this._createTempFile(request);
    await this._getBuildOutput(document.buildOutput, file.name);
    const dir = this._createTempDir(request);
    await decompress(file.name, dir.name, { strip: 1 });
    document._metadata.contentLocation = `${dir.name}${path.sep}scancode-${_toolVersion}.json`;
    document._metadata.contentType = 'application/json';
    return request;
  }

  _getBuildOutput(outputUrl, destination) {
    return new Promise((resolve, reject) => {
      nodeRequest.get(outputUrl, { headers: { Authorization: this.authToken } }, (error, response) => {
        if (error) {
          return reject(error);
        }
        if (response.statusCode === 200) {
          return resolve(null);
        }
        reject(new Error(`${response.statusCode} ${response.statusMessage}`));
      }).pipe(fs.createWriteStream(destination));
    });
  }
}

module.exports = options => new VstsProcessor(options);