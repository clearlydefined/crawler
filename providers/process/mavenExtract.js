// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const fs = require('fs');
const sourceDiscovery = require('../../lib/sourceDiscovery');
const SourceSpec = require('../../lib/sourceSpec');
const parseString = require('xml2js').parseString;

class MavenExtract extends BaseHandler {

  get schemaVersion() {
    return 1;
  }

  get toolSpec() {
    return { tool: 'clearlydescribed', toolVersion: this.schemaVersion };
  }

  canHandle(request) {
    const spec = this.toSpec(request);
    return request.type === 'maven' && spec && spec.type === 'maven';
  }

  // Coming in here we expect the request.document to have id, location and metadata properties.
  // Do interesting processing...
  async handle(request) {
    if (this.isProcessing(request)) {
      // skip all the hard work if we are just traversing.
      const { spec } = super._process(request);
      this.addBasicToolLinks(request, spec);
      const manifest = await this._getManifest(request.document.location);
      await this._createDocument(request, manifest, request.document.metadata);
    }
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.adopt(request.document.sourceInfo);
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec());
    }
    return request;
  }

  async _getManifest(location) {
    const manifestContent = fs.readFileSync(location);
    return await new Promise((resolve, reject) => parseString(manifestContent,
      (error, result) => error ? reject(error) : resolve(result)));
  }

  _discoverCandidateSourceLocations(manifest) {
    const candidateUrls = [];
    if (manifest.project && manifest.project.scm)
      candidateUrls.push(manifest.project.scm.url);
    return candidateUrls;
  }

  async _discoverSource(version, locations) {
    // TODO lookup source discovery in a set of services that have their own configuration
    return sourceDiscovery(version, locations, { githubToken: this.options.githubToken });
  }

  async _createDocument(request, manifest, metadata) {
    // setup the manifest to be the new document for the request
    request.document = { _metadata: request.document._metadata, manifest, metadata };
    // Add interesting info
    const manifestCandidates = this._discoverCandidateSourceLocations(manifest);
    const sourceInfo = await this._discoverSource(metadata.version, [...manifestCandidates]);
    if (sourceInfo)
      return request.document.sourceInfo = sourceInfo;

    // didn't find any source so make up a sources url to try
    // TODO see if we can get this info from the earlier searches.
    // We may not be guaranteed to have come here via those earlier paths however...
    const mavenSourceInfo = { type: 'maven-source', provider: 'maven-central', url: manifest.id.replace(':', '/'), revision: manifest.version };
    request.document.sourceInfo = mavenSourceInfo;
  }
}

module.exports = options => new MavenExtract(options);