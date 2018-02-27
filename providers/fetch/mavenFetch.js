// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const nodeRequest = require('request');
const requestPromise = require('request-promise-native');
const fs = require('fs');

const providerMap = {
  mavencentral: "https://search.maven.org/remotecontent?filepath="
}

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
    return new Promise((resolve, reject) => {
      const extension = spec.type === 'sourcearchive' ? '-sources.jar' : '.pom';
      nodeRequest.get(this._buildUrl(spec, extension), (error, response) => {
        if (error)
          return reject(error);
        if (response.statusCode === 404)
          resolve(response.statusCode);
        if (response.statusCode !== 200)
          reject(new Error(`${response.statusCode} ${response.statusMessage}`))
      }).pipe(fs.createWriteStream(destination).on('finish', () => resolve(null)));
    });
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

  _buildUrl(spec, extension) {
    const fullName = `${spec.namespace}/${spec.name}`.replace(/\./g, '/');
    return `${providerMap[spec.provider]}${fullName}/${spec.revision}/${spec.name}-${spec.revision}${extension}`
  }

  _createDocument(location, registryData) {
    const releaseDate = new Date(registryData.timestamp).toISOString();
    return { location: location.name, registryData, releaseDate }
  }
}

module.exports = options => new MavenFetch(options);