// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const VstsBuild = require('../../lib/build/vsts');
const recursive = require('recursive-readdir');

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
    const size = await this._computeSize(document);
    request.addMeta({ k: size.k, fileCount: size.count });
    if (spec.provider === 'github' && size.k > this.options.maxSize || size.count > this.options.maxCount) {
      this.logger.info(`Analyzing ${request.toString()} using ScanCode in VSTS build. Files: ${size.count} Size: ${size.k} KB.`);
      try {
        const vstsBuild = new VstsBuild(this.options.build);
        request.context.releaseDate = document.releaseDate;
        const build = await vstsBuild.queueBuild(request, spec);
        this.logger.info(`Queued VSTS build ${build.id}`, { url: build._links.web.href });
      } catch (error) {
        this.logger.error(error, `${request.toString()} - error queueing build`);
        return request.markRequeue('VSTS', 'Error queueing build');
      }
      return request.markNoSave();
    }
    this.addBasicToolLinks(request, spec);
    const file = this._createTempFile(request);
    this.logger.info(`Analyzing ${request.toString()} using ScanCode. input: ${request.document.location} output: ${file.name}`);

    return new Promise((resolve, reject) => {
      const parameters = [...this.options.options,
        '--timeout', this.options.timeout.toString(),
        '-n', this.options.processes.toString(),
        '-f', this.options.format,
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
        document._metadata.releaseDate = request.document.releaseDate;
        resolve(request);
      });
    });
  }

  async _computeSize(document) {
    const files = await recursive(document.location);
    const bytes = files.reduce((sum, file) => {
      if (!this._shouldCountFile(file, document.location))
        return sum;
      const stat = fs.lstatSync(file);
      return sum + stat.size;
    }, 0);
    return { k: Math.round(bytes / 1024), count: files.length };
  }

  _shouldCountFile(file, location) {
    const filePath = file.slice(location.length + 1);
    if (filePath.startsWith('.git'))
      return false;
    return true;
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