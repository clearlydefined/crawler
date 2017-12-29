// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const nodeRequest = require('request');
const requestPromise = require('request-promise-native');
const fs = require('fs');

const providerMap = {
  npmjs: "https://registry.npmjs.org"
}

class NpmFetch extends BaseHandler {

  get schemaVersion() {
    return 1;
  }

  getHandler(request, type = request.type) {
    const spec = this.toSpec(request);
    return spec && spec.type === 'npm' ? this._fetch.bind(this) : null;
  }

  async _fetch(request) {
    const spec = this.toSpec(request);
    // if there is no revision, return an empty doc. The processor will find
    if (!spec.revision) {
      const latest = await this._findLatestVersion(request);
      spec.revision = latest.version;
      // rewrite the request URL as it is used throughout the system to derive locations and urns etc.
      request.url = spec.toUrl();
    }
    const uri = this._buildUrl(spec);
    const file = this._createTempFile(request);
    var options = {
      method: 'GET',
      uri,
    };
    return new Promise((resolve, reject) => {
      nodeRequest(options, (error, response, body) => {
        if (error)
          return reject(error);
        if (response.statusCode === 200) {
          request.document = this._createDocument(spec, file);
          request.contentOrigin = 'origin';
          return resolve(request);
        }
        reject(new Error(`${response.statusCode} ${response.statusMessage}`))
      }).pipe(fs.createWriteStream(file.name));
    });
  }

  // query npmjs to find the latest version of the give package
  async _findLatestVersion(request) {
    const spec = this.toSpec(request);
    // Per https://github.com/npm/registry/issues/45 we should retrieve the whole package and get the version we want from that.
    // The version-specific API (e.g. append /x.y.z to URL) does NOT work for scoped packages.
    const baseUrl = providerMap[spec.provider];
    if (!baseUrl)
      throw new Error(`Could not find definition for NPM provider: ${spec.provider}.`)
    const fullName = `${spec.namespace ? '/' + spec.namespace : ''}${spec.name}`;
    const packageInfo = await requestPromise({
      url: `${baseUrl}/${encodeURIComponent(fullName).replace('%40', '@')}`, // npmjs doesn't handle the escaped version
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

  _buildUrl(spec) {
    const fullName = spec.namespace ? `${spec.namespace}/${spec.name}` : spec.name;
    return `${providerMap[spec.provider]}/${fullName}/-/${spec.name}-${spec.revision}.tgz`
  }

  _createDocument(spec, file) {
    return { id: spec.toUrn(), location: file.name }
  }
}

module.exports = options => new NpmFetch(options);