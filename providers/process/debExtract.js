// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const { merge } = require('lodash')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')

class DebExtract extends AbstractClearlyDefinedProcessor {
  constructor(options, sourceFinder) {
    super(options)
    this.sourceFinder = sourceFinder
  }

  get toolVersion() {
    return '1.0.0'
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'deb' && spec && spec.type === 'deb'
  }

  // Coming in here we expect the request.document to have id, location and metadata properties.
  // Do interesting processing...
  async handle(request) {
    if (this.isProcessing(request)) {
      await super.handle(request)
      const spec = this.toSpec(request)
      this._createDocument(request, spec, request.document.registryData)
    }
    this.linkAndQueueTool(request, 'licensee')
    // this.linkAndQueueTool(request, 'fossology')
    this.linkAndQueueTool(request, 'scancode')
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.fromObject(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
    return request
  }

  _createDocument(request, spec, registryData) {
    const releaseDate = request.document.releaseDate
    request.document = merge(this.clone(request.document), { registryData, releaseDate })
    const sourceInfo = this._discoverSource(spec, registryData)
    if (sourceInfo) request.document.sourceInfo = sourceInfo
  }

  _discoverSource(spec, registryData) {
    const [revision, architecture] = spec.revision.split('_')
    const source = (registryData.find(entry => entry.Architecture === architecture) || {}).Source
    if (source) {
      const result = SourceSpec.fromObject(spec)
      result.type = 'debsrc'
      result.name = source // Sometimes the source name differs from the binary one
      result.revision = revision // Without architecture
      return result
    }
    return null
  }
}

module.exports = (options, sourceFinder) => new DebExtract(options, sourceFinder || sourceDiscovery)
