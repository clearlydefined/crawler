// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')
const { merge } = require('lodash')

class CrateExtract extends AbstractClearlyDefinedProcessor {
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
    return request.type === 'crate' && spec && spec.type === 'crate'
  }

  async handle(request) {
    if (this.isProcessing(request)) {
      await super.handle(request)
      await this._createDocument(request, request.document.manifest, request.document.registryData)
    }
    this.linkAndQueueTool(request, 'licensee')
    this.linkAndQueueTool(request, 'fossology')
    this.linkAndQueueTool(request, 'scancode')
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.fromObject(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
  }

  async _createDocument(request, manifest, registryData) {
    request.document = merge(this.clone(request.document), { manifest, registryData })
    const sourceInfo = await this._discoverSource(manifest, registryData)
    if (sourceInfo) request.document.sourceInfo = sourceInfo
  }

  _discoverSource(manifest, registryData) {
    return this.sourceFinder(registryData.num, [manifest.repository, manifest.homepage, manifest.documentation], {
      githubToken: this.options.githubToken
    })
  }
}

module.exports = (options, sourceFinder) => new CrateExtract(options, sourceFinder || sourceDiscovery)
