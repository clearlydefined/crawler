// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const nodeRequest = require('request');
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

  _buildUrl(spec) {
    const fullName = spec.namespace ? `${spec.namespace}/${spec.name}` : spec.name;
    return `${providerMap[spec.provider]}/${fullName}/-/${spec.name}-${spec.revision}.tgz`
  }

  _createDocument(spec, file) {
    return { id: spec.toUrn(), location: file.name }
  }
}

module.exports = options => new NpmFetch(options);