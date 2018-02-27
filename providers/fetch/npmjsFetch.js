// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const nodeRequest = require('request');
const requestPromise = require('request-promise-native');
const fs = require('fs');

const providerMap = {
  npmjs: "https://registry.npmjs.com"
}

class NpmFetch extends BaseHandler {

  canHandle(request) {
    const spec = this.toSpec(request);
    return spec && spec.provider === 'npmjs';
  }

  async handle(request) {
    const spec = this.toSpec(request);
    const registryData = await this._getRegistryData(request);
    spec.revision = registryData ? registryData.manifest.version : spec.revision;
    // rewrite the request URL as it is used throughout the system to derive locations and urns etc.
    request.url = spec.toUrl();
    const file = this._createTempFile(request);
    await this._getPackage(spec, file.name);
    const dir = this._createTempDir(request);
    await this.decompress(file.name, dir.name);
    request.document = this._createDocument(dir, registryData);
    request.contentOrigin = 'origin';
    return request;
  }

  async _getPackage(spec, destination) {
    return new Promise((resolve, reject) => {
      nodeRequest.get(this._buildUrl(spec), (error, response) => {
        if (error)
          return reject(error);
        if (response.statusCode !== 200)
          reject(new Error(`${response.statusCode} ${response.statusMessage}`))
      }).pipe(fs.createWriteStream(destination).on('finish', () => resolve(null)));
    });
  }

  // query npmjs to get the latest and fullest metadata. Turns out that there is somehow more in the
  // service than in the package manifest in some cases (e.g., lodash).
  async _getRegistryData(request) {
    const spec = this.toSpec(request);
    // Per https://github.com/npm/registry/issues/45 we should retrieve the whole package and get the version we want from that.
    // The version-specific API (e.g. append /x.y.z to URL) does NOT work for scoped packages.
    const baseUrl = providerMap[spec.provider];
    if (!baseUrl)
      throw new Error(`Could not find definition for NPM provider: ${spec.provider}.`)
    const fullName = `${spec.namespace ? spec.namespace + '/' : ''}${spec.name}`;
    const registryData = await requestPromise({
      url: `${baseUrl}/${encodeURIComponent(fullName).replace('%40', '@')}`, // npmjs doesn't handle the escaped version
      json: true
    });

    if (!registryData.versions)
      return null;
    const version = spec.revision || this.getLatestVersion(Object.keys(registryData.versions));
    if (!registryData.versions[version])
      return null;
    const date = registryData.time[version];
    const registryManifest = registryData.versions[version];
    delete registryData.versions;
    delete registryData.time;
    registryData.manifest = registryManifest;
    registryData.releaseDate = date;
    return registryData;
  }

  _buildUrl(spec) {
    const fullName = spec.namespace ? `${spec.namespace}/${spec.name}` : spec.name;
    return `${providerMap[spec.provider]}/${fullName}/-/${spec.name}-${spec.revision}.tgz`
  }

  _createDocument(dir, registryData) {
    const releaseDate = registryData.releaseDate;
    return { location: dir.name, registryData, releaseDate };
  }
}

module.exports = options => new NpmFetch(options);