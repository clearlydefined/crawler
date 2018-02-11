// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const nodeRequest = require('request');
const requestPromise = require('request-promise-native');
const fs = require('fs');

const providerMap = {
  mavenCentral: "https://search.maven.org/remotecontent?filepath="
}

class MavenSourceFetch extends BaseHandler {

  canHandle(request) {
    const spec = this.toSpec(request);
    return spec && spec.type === 'sourceArchive' && spec.provider === 'mavenCentral';
  }

  async handle(request) {
    const spec = this.toSpec(request);
    // if there is no revision, return an empty doc. The processor will find
    const metadata = await this._getMetadata(request);
    spec.revision = metadata.version;
    // rewrite the request URL as it is used throughout the system to derive locations and urns etc.
    request.url = spec.toUrl();
    const file = this._createTempFile(request);
    const code = await this._getPackage(spec, file.name);
    if (code === 404)
      return request.markSkip('Missing  ');
    const dir = this._createTempDir(request);
    await this.unzip(file.name, dir.name);
    request.document = this._createDocument(spec, dir, metadata);
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
        if (response.statusCode === 200 || response.statusCode === 404)
          return resolve(response.statusCode);
        reject(new Error(`${response.statusCode} ${response.statusMessage}`))
      }).pipe(fs.createWriteStream(destination));
    });
  }

  // query maven to get the latest version if we don't already have that.
  async _getMetadata(request) {
    const spec = this.toSpec(request);
    if (spec.revision)
      return { version: spec.revision }
    const url = this._buildUrl(spec);
    const packageInfo = await requestPromise({ url, json: true });
    if (!packageInfo.response.docs.length === 0)
      return null;
    return { version: packageInfo.response.docs[0].v };
  }

  _buildUrl(spec) {
    const fullName = `${spec.namespace}/${spec.name}`.replace(/\./g, '/');
    return `${providerMap[spec.provider]}${fullName}/${spec.revision}/${spec.name}-${spec.revision}-sources.jar`
  }

  _createDocument(spec, file, metadata) {
    return { id: spec.toUrn(), location: file.name, metadata }
  }
}

module.exports = options => new MavenSourceFetch(options);