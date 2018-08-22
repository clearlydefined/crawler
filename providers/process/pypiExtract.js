// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')

class PyPiExtract extends BaseHandler {
  get schemaVersion() {
    return '1.1.0'
  }

  get toolSpec() {
    return { tool: 'clearlydefined', toolVersion: this.schemaVersion }
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'pypi' && spec && spec.type === 'pypi'
  }

  async handle(request) {
    if (this.isProcessing(request)) {
      const { spec } = super._process(request)
      spec.name = request.document.registryData.info.name
      this.addBasicToolLinks(request, spec)
      await this._createDocument(request, spec, request.document.registryData)
      await BaseHandler.addInterestingFiles(request.document, request.document.location)
    }
    this.linkAndQueueTool(request, 'scancode')
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.adopt(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
    return request
  }

  async _discoverSource(spec, registryData) {
    if (!registryData) return null
    const candidates = []
    registryData.info.bugtrack_url && candidates.push(registryData.info.bugtrack_url)
    registryData.info.docs_url && candidates.push(registryData.info.docs_url)
    registryData.info.download_url && candidates.push(registryData.info.download_url)
    registryData.info.home_page && candidates.push(registryData.info.home_page)
    registryData.info.package_url && candidates.push(registryData.info.package_url)
    registryData.info.project_url && candidates.push(registryData.info.project_url)
    registryData.info.release_url && candidates.push(registryData.info.release_url)
    return sourceDiscovery(spec.revision, candidates, { githubToken: this.options.githubToken })
  }

  async _createDocument(request, spec, registryData) {
    const sourceInfo = await this._discoverSource(spec, registryData)
    if (sourceInfo) request.document.sourceInfo = sourceInfo
  }
}

module.exports = options => new PyPiExtract(options)
