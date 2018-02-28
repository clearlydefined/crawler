// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const mavenCentral = require('../../lib/mavenCentral');
const nodeRequest = require('request');
const requestPromise = require('request-promise-native');

class MavenFetch extends BaseHandler {

  canHandle(request) {
    const spec = this.toSpec(request);
    return spec && spec.provider === 'mavencentral';
  }

  async handle(request) {
    const spec = this.toSpec(request);
    // if there is no revision, return an empty doc. The processor will find
    const registryData = await this._getRegistryData(request);
    spec.revision = spec.revision ? registryData.v : registryData.latestVersion;
    // rewrite the request URL as it is used throughout the system to derive locations and urns etc.
    request.url = spec.toUrl();
    const file = this._createTempFile(request);
    const code = await this._getArtifact(spec, file.name);
    if (code === 404)
      return request.markSkip('Missing  ');
    const location = await this._postProcessArtifact(request, spec, file);
    request.document = this._createDocument(location, registryData);
    request.contentOrigin = 'origin';
    return request;
  }

  async _postProcessArtifact(request, spec, file) {
    if (spec.type !== 'sourcearchive')
      return file;
    const dir = this._createTempDir(request);
    await this.unzip(file.name, dir.name);
    return dir;
  }

  async _getArtifact(spec, destination) {
    if (spec.type === 'sourcearchive')
      return await mavenCentral.fetchSourcesJar(spec, destination);
    else
      return await mavenCentral.fetchPom(spec, destination);
  }

  // query maven to get the latest version if we don't already have that.
  async _getRegistryData(request) {
    const spec = this.toSpec(request);
    const versionClause = spec.revision ? `+AND+v:"${spec.revision}"` : '';
    const url = `https://search.maven.org/solrsearch/select?q=g:"${spec.namespace}"+AND+a:"${spec.name}"${versionClause}&rows=1&wt=json`;
    const packageInfo = await requestPromise({ url, json: true });
    if (!packageInfo.response.docs.length === 0)
      return null;
    return packageInfo.response.docs[0];
  }

  _createDocument(location, registryData) {
    const releaseDate = new Date(registryData.timestamp).toISOString();
    return { location: location.name, registryData, releaseDate }
  }
}

module.exports = options => new MavenFetch(options);