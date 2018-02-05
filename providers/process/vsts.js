// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const decompress = require('decompress');
const fs = require('fs');
const nodeRequest = require('request');
const path = require('path');
const { promisify } = require('util');

let _toolVersion;

class VstsProcessor extends BaseHandler {

  get schemaVersion() {
    return _toolVersion;
  }

  get toolSpec() {
    return { tool: 'scancode', toolVersion: this.schemaVersion };
  }

  get authToken() {
    return 'Basic ' + new Buffer(this.options.apiToken + ':', 'utf8').toString('base64');
  }

  canHandle(request) {
    _toolVersion = (request.document && request.document.toolVersion) || '2.2.1';
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
    try {
      const scancodeFilePath = `${dir.name}${path.sep}scancode.json`;
      await promisify(fs.access)(scancodeFilePath);
      document._metadata.contentLocation = scancodeFilePath;
      document._metadata.contentType = 'application/json';
      return request;
    } catch (error) {
      const buildError = (await promisify(fs.readFile)(`${dir.name}${path.sep}error.json`)).toString();
      throw new Error(JSON.parse(buildError).error);
    }
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