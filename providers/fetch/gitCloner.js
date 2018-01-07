// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const { exec } = require('child_process');
const SourceSpec = require('../../lib/sourceSpec');

class GitHubCloner extends BaseHandler {

  canHandle(request, type = request.type) {
    const spec = this.toSpec(request);
    return spec && spec.type === 'git';
  }

  async handle(request) {
    const spec = this.toSpec(request);
    if (!spec.tool) {
      // shortcut. if there is no tool to run then no need to get the repo
      request.document = {};
      request.contentOrigin = 'origin';
      return request;
    }
    const sourceSpec = this._toSourceSpec(spec);
    const options = { version: sourceSpec.revision };
    const dir = this._createTempDir(request);

    await this._cloneRepo(sourceSpec.url, dir.name, spec.name, options.version);

    request.contentOrigin = 'origin';
    request.document = this._createDocument(dir.name + '/' + spec.name);
    return request;
  }

  _createDocument(dir) {
    // Create a simple document that records the location of the repo that was fetched
    return { location: dir };
  }

  _toSourceSpec(spec) {
    const url = `https://github.com/${spec.namespace}/${spec.name}.git`
    return new SourceSpec('git', 'github', url, spec.revision);
  }

  _cloneRepo(sourceUrl, dirName, specName, commit) {
    return new Promise((resolve, reject) => {
      exec(`cd ${dirName} && git clone ${sourceUrl} && cd ${specName} && git reset --hard ${commit}`, (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }
        resolve(stdout);
      });
    });
  }
}

module.exports = options => new GitHubCloner(options);