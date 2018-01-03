// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const { exec } = require('child_process');
const fs = require('fs');

let toolVersion = null;

class ScanCodeProcessor extends BaseHandler {

  get schemaVersion() {
    return 1;
  }

  get toolSpec() {
    return { tool: 'scancode', toolVersion };
  }

  getHandler(request) {
    const spec = this.toSpec(request);
    return spec && spec.tool === 'scancode' ? this._process.bind(this) : null;
  }

  async _process(request) {
    // need to do this first so the urns have the right version.
    await this._detectVersion();
    const { document, spec } = super._process(request);
    this.addBasicToolLinks(request, spec);
    const file = this._createTempFile(request);
    document._metadata.contentLocation = file.name;
    document._metadata.contentType = 'application/json';
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
      exec(`cd ${this.options.installDir} && ./scancode ${parameters}`, (error, stdout, stderr) => {
        if (error || this._hasRealErrors(file.name))
          return reject(error);
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

  async _detectVersion() {
    if (toolVersion)
      return toolVersion;
    return new Promise((resolve, reject) => {
      exec(`cd ${this.options.installDir} && ./scancode --version`, (error, stdout, stderr) => {
        if (error)
          return reject(error);
        toolVersion = stdout.replace('ScanCode version ', '').trim();
        resolve(toolVersion);
      });
    });
  }
}

module.exports = options => new ScanCodeProcessor(options);