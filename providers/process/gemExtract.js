// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const SourceSpec = require('../../lib/sourceSpec')
const sourceDiscovery = require('../../lib/sourceDiscovery')

class GemExtract extends BaseHandler {
  get schemaVersion() {
    return 1
  }

  get toolSpec() {
    return { tool: 'clearlydefined', toolVersion: this.schemaVersion }
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'gem' && spec && spec.type === 'gem'
  }

  async handle(request) {
    console.log('gem extract')
    if (this.isProcessing(request)) {
      const { document, spec } = super._process(request)
      this.addBasicToolLinks(request, spec)
      await this._createDocument(request, request.document.registryData)
    }
    //queue scancode here
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.adopt(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
    return request
  }

  async _getMetadataLocation(dir) {
    if (fs.existsSync(path.join(dir, 'metadata.yaml'))) {
      return path.join(dir, 'metadata.yaml')
    }
  }

  async _discoverSource(registryData) {
    const candidates = []
    registryData.bug_tracker_uri && candidates.push(registryData.bug_tracker_uri)
    registryData.changelog_uri && candidates.push(registryData.changelog_uri)
    registryData.documentation_uri && candidates.push(registryData.documentation_uri)
    registryData.gem_uri && candidates.push(registryData.gem_uri)
    registryData.homepage_uri && candidates.push(registryData.homepage_uri)
    registryData.mailing_list_uri && candidates.push(registryData.mailing_list_uri)
    registryData.source_code_uri && candidates.push(registryData.source_code_uri)
    return sourceDiscovery(registryData.version, candidates, { githubToken: this.options.githubToken })
  }

  async _createDocument(request, registryData) {
    const sourceInfo = await this._discoverSource(registryData)
    if (sourceInfo) request.document.sourceInfo = sourceInfo
  }
}

module.exports = options => new GemExtract(options)
