// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const nodeRequest = require('request');
const requestPromise = require('request-promise-native');
const fs = require('fs');
const decompress = require('decompress');

const providerMap = {
  mavenCentral: "https://search.maven.org/remotecontent?filepath="
}

class MavenSourceFetch extends BaseHandler {

  canHandle(request) {
    const spec = this.toSpec(request);
    return spec && spec.type === 'maven-source' && spec.provider === 'maven-central';
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
    await decompress(file.name, dir.name);
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
        if (response.statusCode === 200)
          return resolve(null);
        reject(new Error(`${response.statusCode} ${response.statusMessage}`))
      }).pipe(fs.createWriteStream(destination));
    });
  }

  // query maven to get the latest version if we don't already have that.
  async _getMetadata(request) {
    const spec = this.toSpec(request);
    if (spec.version)
      return { version: spec.version }
    const url = this._buildUrl(spec);
    const packageInfo = await requestPromise({ url, json: true });
    if (!packageInfo.response.docs.length === 0)
      return null;
    return { version: packageInfo.response.docs[0].v };
  }

  _buildUrl(spec) {
    const fullName = `${spec.namespace}/${spec.name}`;
    return `${providerMap[spec.provider]}/${fullName}-${spec.revision}-sources.jar`
  }

  _createDocument(spec, file, metadata) {
    return { id: spec.toUrn(), location: file.name, metadata }
  }
}

module.exports = options => new MavenSourceFetch(options);