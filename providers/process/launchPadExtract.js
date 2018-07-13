// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// Copyright (c) 2018, The Linux Foundation. All rights reserved.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')

class LaunchpadExtract extends BaseHandler {
  get schemaVersion() {
    return 1
  }

  get toolSpec() {
    return { tool: 'clearlydefined', toolVersion: this.schemaVersion }
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'launchpad' && spec && spec.type === 'launchpad'
  }

  async handle(request) {
    if (this.isProcessing(request)) {
      const { spec } = super._process(request)
      this.addBasicToolLinks(request, spec)
      await this._createDocument(spec, request, request.document.registryData)
    }
    this.linkAndQueueTool(request, 'scancode')
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.adopt(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
    return request
  }


  async _discoverSource(spec, registryData) {
    const candidates = []
    if (!registryData) {
      return null
    }
    registryData.bug_tracker_link && candidates.push(registryData.bug_tracker_link)
    registryData.wiki_url && candidates.push(registryData.wiki_url)
    registryData.download_url && candidates.push(registryData.download_url)
    registryData.homepage_url && candidates.push(registryData.homepage_url)
    registryData.releases_collection_link && candidates.push(releases_collection_link)
    // Most of these won't be useful for launchpad, I think there are other API calls to find
    // the launchpad mirror (code.launchpad.net) if it exists
    return sourceDiscovery(spec.revision, candidates, { githubToken: this.options.githubToken })
  }

  async _createDocument(spec, request, registryData) {
    const sourceInfo = await this._discoverSource(spec, registryData)
    if (sourceInfo) request.document.sourceInfo = sourceInfo
  }
}

module.exports = options => new LaunchpadExtract(options)
