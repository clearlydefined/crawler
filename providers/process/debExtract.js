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
      await this._createDocument(request, request.document.registryData)
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

  async _createDocument(request, registryData) {
    request.document = merge(this.clone(request.document), { registryData })
    // ???
    // const sourceInfo = await this._discoverSource(this.toSpec(request).revision, registryData)
    // if (sourceInfo) request.document.sourceInfo = sourceInfo
  }
}

module.exports = (options, sourceFinder) => new DebExtract(options, sourceFinder || sourceDiscovery)
