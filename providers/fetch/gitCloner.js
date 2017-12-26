// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const Git = require('nodegit');
const SourceSpec = require('../../lib/sourceSpec');

class GitHubCloner extends BaseHandler {

  get schemaVersion() {
    return 1;
  }

  getHandler(request, type = request.type) {
    const spec = this.toSpec(request);
    return spec && spec.type === 'git' ? this._fetch.bind(this) : null;
  }

  async _fetch(request) {
    const spec = this.toSpec(request);
    if (!spec.tool) {
      // shortcut. if there is no tool to run then no need to get the repo
      request.document = {};
      return request;
    }
    const sourceSpec = this._toSourceSpec(spec);
    const options = { version: sourceSpec.revision };
    const dir = this._createTempDir(request);

    const repo = await Git.Clone(sourceSpec.url, dir.name, options)

    request.contentOrigin = 'origin';
    request.document = this._createDocument(dir);
    return request;
  }

  _createDocument(dir) {
    // Create a simple document that records the location of the repo that was fetched
    return { location: dir.name };
  }

  _toSourceSpec(spec) {
    const url = `https://github.com/${spec.namespace}/${spec.name}.git`
    return new SourceSpec('git', 'github', url, spec.revision);
  }
}

module.exports = options => new GitHubCloner(options);