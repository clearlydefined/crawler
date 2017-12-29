// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const decompress = require('decompress');
const path = require('path');
const sourceDiscovery = require('../../lib/sourceDiscovery');

class NpmExtract extends BaseHandler {

  get schemaVersion() {
    return 1;
  }

  get toolSpec() {
    return { tool: 'clearlydescribed', toolVersion: 1 };
  }

  getHandler(request, type = request.type) {
    return type === 'npm' ? this._process.bind(this) : null;
  }

  async _process(request) {
    const { document, spec } = super._process(request);
    this.addBasicToolLinks(request, spec);
    const file = request.document.location;
    const dir = this._createTempDir(request);
    const files = await decompress(file, dir.name, { filter: entry => entry.path === 'package/package.json' });
    if (files.length !== 1)
      throw new Error('missing package.json file');
    const manifest = JSON.parse(files[0].data.toString());
    await this._updateDocument(request, manifest);
    return request;
  }

  async _discoverSourceLocation(manifest) {
    const candidateUrls = [];
    if (manifest.repository && manifest.repository.url)
      candidateUrls.push(manifest.repository.url);
    if (manifest.url)
      candidateUrls.push(manifest.url);
    if (manifest.homepage)
      candidateUrls.push(manifest.homepage);
    if (manifest.bugs && manifest.bugs.url)
      candidateUrls.push(manifest.bugs.url);

    return sourceDiscovery(manifest.version, candidateUrls);
  }

  async _updateDocument(request, manifest) {
    // setup the manifest to be the new document for the request
    request.document = { _metadata: request.document._metadata, manifest };
    // Add interesting info
    const sourceInfo = await this._discoverSourceLocation(manifest);
    if (sourceInfo) {
      request.document.sourceInfo = sourceInfo;
      this.linkAndQueue(request, 'source', sourceInfo.toEntitySpec());
    }
  }
}

module.exports = options => new NpmExtract(options);