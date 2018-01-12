// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const vsts = require('vso-node-api');

class VstsBuild {
  constructor(options) {
    this.options = options.vsts;
    this.crawlerRequestUrl = options.crawlerUrl + '/requests';
    this.crawlerAuthToken = options.crawlerAuthToken;
    if (!this.options.apiToken) {
      throw new Error('VSTS build API token must be provided.');
    }
    const authHandler = vsts.getPersonalAccessTokenHandler(this.options.apiToken);
    const connection = new vsts.WebApi(this.options.collectionUrl, authHandler);
    this.vstsBuild = connection.getBuildApi();
  }

  async queueBuild(document, spec, requestUrl) {
    const definitions = await this.vstsBuild.getDefinitions(this.options.project, this.options.definitionName);
    if (!definitions && !definitions[0]) {
      // TODO: create build definition
      throw new Error(`No build definition found for ${this.options.definitionName}`);
    }
    const build = {
      definition: {
        id: definitions[0].id
      },
      parameters: JSON.stringify({
        sourceUrl: `https://github.com/${spec.namespace}/${spec.name}.git`,
        sourceCommit: spec.revision,
        callbackCommand: this._getCallbackCommand(requestUrl)
      })
    };
    return await this.vstsBuild.queueBuild(build, this.options.project);
  }

  _getCallbackCommand(requestUrl) {
    const body = JSON.stringify({
      type: 'ingest-vsts',
      url: requestUrl,
      payload: {
        body: {
          buildOutput: '__DOWNLOAD_URL__' // will be replaced by VSTS build
        }
      }
    });
    return `curl ${this.crawlerRequestUrl} -X POST -d ${JSON.stringify(body)} --header "Content-Type:application/json" --header "X-token:${this.crawlerAuthToken}"`;
  }
}

module.exports = VstsBuild;