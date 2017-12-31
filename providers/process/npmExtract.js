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

  // Coming in here we expect the request.document to have id, location and metadata properties.
  // Do interesting processing...
  async _process(request) {
    const { document, spec } = super._process(request);
    this.addBasicToolLinks(request, spec);
    const file = request.document.location;
    const dir = this._createTempDir(request);
    const files = await decompress(file, dir.name, { filter: entry => entry.path === 'package/package.json' });
    if (files.length !== 1)
      throw new Error('missing package.json file');
    const manifest = JSON.parse(files[0].data.toString());
    await this._updateDocument(request, manifest, request.document.metadata.packageManifest);
    return request;
  }

  _discoverCandidateSourceLocations(manifest) {
    const candidateUrls = [];
    if (manifest.repository && manifest.repository.url)
      candidateUrls.push(manifest.repository.url);
    if (manifest.url)
      candidateUrls.push(manifest.url);
    if (manifest.homepage)
      candidateUrls.push(manifest.homepage);
    if (manifest.bugs && manifest.bugs.url)
      candidateUrls.push(manifest.bugs.url);
    return candidateUrls;
  }

  async _discoverSource(version, locations) {
    // TODO lookup source discovery in a set of services that have their own configuration
    return sourceDiscovery(version, locations, { githubToken: this.options.githubToken });
  }

  async _updateDocument(request, manifest, metadata) {
    // setup the manifest to be the new document for the request
    request.document = { _metadata: request.document._metadata, manifest, metadata };
    // Add interesting info
    const manifestCandidates = this._discoverCandidateSourceLocations(manifest);
    const metadataCandidates = this._discoverCandidateSourceLocations(metadata);
    const sourceInfo = await this._discoverSource(metadata.version, [...manifestCandidates, ...metadataCandidates]);
    if (sourceInfo) {
      request.document.sourceInfo = sourceInfo;
      this.linkAndQueue(request, 'source', sourceInfo.toEntitySpec());
    }
  }
}

module.exports = options => new NpmExtract(options);