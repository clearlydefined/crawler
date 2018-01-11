// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const nodeRequest = require('request');
const requestPromise = require('request-promise-native');
const fs = require('fs');
const decompress = require('decompress');

const providerMap = {
  npmjs: "https://registry.npmjs.org"
}

class NpmFetch extends BaseHandler {

  canHandle(request) {
    const spec = this.toSpec(request);
    return spec && spec.provider === 'npmjs';
  }

  async handle(request) {
    const spec = this.toSpec(request);
    // if there is no revision, return an empty doc. The processor will find
    const metadata = await this._getMetadata(request);
    spec.revision = metadata.version;
    // rewrite the request URL as it is used throughout the system to derive locations and urns etc.
    request.url = spec.toUrl();
    const file = this._createTempFile(request);
    await this._getPackage(spec, file.name);
    const dir = this._createTempDir(request);
    const files = await decompress(file.name, dir.name);
    const sizeInBytes = files.map(file => file.data.length).reduce((previousValue, currentValue) => previousValue + currentValue);
    request.document = this._createDocument(spec, dir, Math.round(sizeInBytes / 1024), metadata);
    request.contentOrigin = 'origin';
    return request;
  }

  async _getPackage(spec, destination) {
    const uri = this._buildUrl(spec);
    var options = {
      method: 'GET',
      uri
    };
    return new Promise((resolve, reject) => {
      nodeRequest(options, (error, response) => {
        if (error)
          return reject(error);
        if (response.statusCode === 200)
          return resolve(null);
        reject(new Error(`${response.statusCode} ${response.statusMessage}`))
      }).pipe(fs.createWriteStream(destination));
    });
  }

  // query npmjs to get the latest and fullest metadata. Turns out that there is somehow more in the
  // service than in the package manifest in some cases (e.g., lodash).
  async _getMetadata(request) {
    const spec = this.toSpec(request);
    // Per https://github.com/npm/registry/issues/45 we should retrieve the whole package and get the version we want from that.
    // The version-specific API (e.g. append /x.y.z to URL) does NOT work for scoped packages.
    const baseUrl = providerMap[spec.provider];
    if (!baseUrl)
      throw new Error(`Could not find definition for NPM provider: ${spec.provider}.`)
    const fullName = `${spec.namespace ? spec.namespace + '/' : ''}${spec.name}`;
    const packageInfo = await requestPromise({
      url: `${baseUrl}/${encodeURIComponent(fullName).replace('%40', '@')}`, // npmjs doesn't handle the escaped version
      json: true
    });

    if (!packageInfo.versions)
      return null;
    const version = spec.revision || this.getLatestVersion(Object.keys(packageInfo.versions));
    return {
      packageManifest: packageInfo.versions[version],
      version
    };
  }

  _buildUrl(spec) {
    const fullName = spec.namespace ? `${spec.namespace}/${spec.name}` : spec.name;
    return `${providerMap[spec.provider]}/${fullName}/-/${spec.name}-${spec.revision}.tgz`
  }

  _createDocument(spec, file, sizeInKb, metadata) {
    return { id: spec.toUrn(), location: file.name, sizeInKb, metadata }
  }
}

module.exports = options => new NpmFetch(options);