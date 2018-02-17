// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler');
const Request = require('ghcrawler').request;
const npm1k = require('npm1k');

class TopProcessor extends BaseHandler {

  get schemaVersion() {
    return 1;
  }

  get toolSpec() {
    return { tool: 'toploader', toolVersion: this.schemaVersion };
  }

  canHandle(request) {
    const spec = this.toSpec(request);
    return request.type === 'top' && spec && spec.provider === 'npmjs';
  }

  handle(request) {
    const { document, spec } = super._process(request);
    this.addBasicToolLinks(request, spec);
    switch (spec.provider) {
      case 'npmjs':
        return this._processTopNpms(request);
      default:
        throw new Error(`Unknown provider type for 'top' request: ${spec.provider}`);
    }
  }

  async _processTopNpms(request) {
    return new Promise((resolve, reject) => {
      npm1k((error, list) => {
        if (error)
          return reject(error);
        const { start, end } = request.document;
        list = start || end ? list.slice(start || 0, end) : list;
        const requests = list.map(p => {
          let [namespace, name] = p.split('/');
          if (!name) {
            name = namespace;
            namespace = '-';
          }
          return new Request('package', `cd:/npm/npmjs/${namespace}/${name}`)
        });
        request.queueRequests(requests);
        resolve(request);
      });
    });
  }
}

module.exports = options => new TopProcessor(options);