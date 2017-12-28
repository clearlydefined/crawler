// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const decompress = require('decompress');
const path = require('path');
const request = require('request-promise-native');
const sourceDiscovery = require('../../lib/sourceDiscovery');

const providerMap = {
  npmjs: 'https://registry.npmjs.org'
};

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

  _process(request) {
    const { document, spec } = super._process(request);
    this.addBasicToolLinks(request, spec);
    return document.location
      ? this._processKnownVersion(request)
      : this._discoverVersionAndQueue(request);
  }

  async _discoverVersionAndQueue(request) {
    const spec = this.toSpec(request);
    const latest = await this._findLatestVersion(spec);
    if (!latest)
      return request;
    spec.latest = latest.version;
    this.linkAndQueue(request, 'latest', spec);
    return request;
  }

  async _processKnownVersion(request, version = this.toSpec(request).version) {
    const file = request.document.location;
    const dir = this._createTempDir(request);
    const files = await decompress(file, dir.name, { filter: entry => entry.path === 'package/package.json' });
    if (files.length !== 1)
      throw new Error('missing package.json file');
    const manifest = JSON.parse(files[0].data.toString());
    await this._updateDocument(request, manifest);
    return request;
  }

  async _findLatestVersion(spec) {
    // Per https://github.com/npm/registry/issues/45 we should retrieve the whole package and get the version we want from that.
    // The version-specific API (e.g. append /x.y.z to URL) does NOT work for scoped packages.
    const baseUrl = providerMap[spec.provider];
    if (!baseUrl)
      throw new Error(`Could not find definition for NPM provider: ${spec.provider}.`)
    const packageInfo = request({
      url: baseUrl + encodeURIComponent(id).replace('%40', '@'), // npmjs doesn't handle the escaped version
      json: true
    });

    if (!packageInfo.versions)
      return null;
    const version = this.getLatestVersion(Object.keys(packageInfo.versions));
    return {
      packageManifest: packageInfo.versions[version],
      version
    };
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