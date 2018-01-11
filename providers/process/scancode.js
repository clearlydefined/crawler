// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

let _toolVersion;

class ScanCodeProcessor extends BaseHandler {

  constructor(options) {
    super(options);
    // TODO little questionable here. Kick off an async operation on load with the expecation that
    // by the time someone actually uses this instance, the call will have completed.
    // Need to detect the tool version before anyone tries to run this processor.
    this._detectVersion();
  }

  get schemaVersion() {
    return _toolVersion;
  }

  get toolSpec() {
    return { tool: 'scancode', toolVersion: this.schemaVersion };
  }

  canHandle(request) {
    return request.type === 'scancode';
  }

  async handle(request) {
    const { document, spec } = super._process(request);
    this.addBasicToolLinks(request, spec);
    const file = this._createTempFile(request);
    this.logger.info(`Analyzing ${request.toString()} using ScanCode. input: ${request.document.location} output: ${file.name}`);

    // TODO really run the scan here
    return new Promise((resolve, reject) => {
      const parameters = [...this.options.options,
        "--timeout", this.options.timeout.toString(),
        "-n", this.options.processes.toString(),
        "-f", this.options.format,
      request.document.location,
      file.name
      ].join(' ');
      exec(`cd ${this.options.installDir} && .${path.sep}scancode ${parameters}`, (error, stdout, stderr) => {
        if (error || this._hasRealErrors(file.name)) {
          request.markDead('Error', error ? error.message : 'ScanCode run failed');
          return reject(error);
        }
        document._metadata.contentLocation = file.name;
        document._metadata.contentType = 'application/json';
        resolve(request);
      });
    });
  }

  // Scan the results file for any errors that are not just timeouts
  _hasRealErrors(resultFile) {
    const results = JSON.parse(fs.readFileSync(resultFile));
    return results.files.some(file =>
      file.scan_errors.some(error => {
        const [timeout] = error.match(/ERROR: Processing interrupted: timeout after (?<timeout>\\d+) seconds./);
        return timeout !== this.options.timeout.toString();
      }));
  }

  _getUrn(spec) {
    const newSpec = Object.assign(Object.create(spec), spec, { tool: 'scancode', toolVersion: this.toolVersion });
    return newSpec.toUrn();
  }

  _detectVersion() {
    if (_toolVersion)
      return _toolVersion;
    return new Promise((resolve, reject) => {
      exec(`cd ${this.options.installDir} && .${path.sep}scancode --version`, (error, stdout, stderr) => {
        if (error)
          return reject(error);
        _toolVersion = stdout.replace('ScanCode version ', '').trim();
        resolve(_toolVersion);
      });
    });
  }
}

module.exports = options => new ScanCodeProcessor(options);