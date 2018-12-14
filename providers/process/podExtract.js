// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')

class PodExtract extends BaseHandler {
  constructor(options, sourceFinder) {
    super(options)
    this.sourceFinder = sourceFinder
  }

  get schemaVersion() {
    return '1.0.0'
  }

  get toolSpec() {
    return { tool: 'clearlydefined', toolVersion: this.schemaVersion }
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'pod' && spec && spec.type === 'pod'
  }

  async handle(request) {
    if (this.isProcessing(request)) {
      const { spec } = super._process(request)
      this.addBasicToolLinks(request, spec)
      const location = request.document.location
      const manifest = request.document.manifest
      await this._createDocument(request, manifest, request.document.registryData)
      await BaseHandler.addInterestingFiles(request.document, location)
    }
    this.linkAndQueueTool(request, 'scancode')
    this.linkAndQueueTool(request, 'fossology')
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.fromObject(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
  }

  async _createDocument(request, manifest, registryData) {
    request.document = { _metadata: request.document._metadata, manifest, registryData }
    const sourceInfo = await this._discoverSource(manifest, registryData)
    if (sourceInfo) request.document.sourceInfo = sourceInfo
  }

  _discoverSource(manifest, registryData) {
    return this.sourceFinder(registryData.num, [manifest.repository], {
      githubToken: this.options.githubToken
    })
  }
}

module.exports = (options, sourceFinder) => new PodExtract(options, sourceFinder || sourceDiscovery)
