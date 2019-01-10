// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')
const { get, merge } = require('lodash')

class PyPiExtract extends AbstractClearlyDefinedProcessor {
  constructor(options, sourceFinder) {
    super(options)
    this.sourceFinder = sourceFinder
  }

  get toolVersion() {
    return '1.1.1'
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'pypi' && spec && spec.type === 'pypi'
  }

  async handle(request) {
    if (this.isProcessing(request)) {
      await super.handle(request)
      const spec = this.toSpec(request)
      await this._createDocument(request, spec, request.document.registryData)
    }
    this.linkAndQueueTool(request, 'licensee')
    this.linkAndQueueTool(request, 'fossology')
    this.linkAndQueueTool(request, 'scancode')
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.fromObject(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
    return request
  }

  async _discoverSource(revision, registryData) {
    if (!registryData) return null
    const candidates = []
    candidates.push(get(registryData, 'info.bugtrack_url'))
    candidates.push(get(registryData, 'info.docs_url'))
    candidates.push(get(registryData, 'info.download_url'))
    candidates.push(get(registryData, 'info.home_page'))
    candidates.push(get(registryData, 'info.package_url'))
    candidates.push(get(registryData, 'info.project_url'))
    candidates.push(get(registryData, 'info.release_url'))
    const allCandidates = candidates.filter(e => e)
    return this.sourceFinder(revision, allCandidates, { githubToken: this.options.githubToken })
  }

  async _createDocument(request, spec, registryData) {
    request.document = merge(this.clone(request.document), {
      registryData,
      declaredLicense: request.document.declaredLicense
    })
    const sourceInfo = await this._discoverSource(spec.revision, registryData)
    if (sourceInfo) request.document.sourceInfo = sourceInfo
  }
}

module.exports = (options, sourceFinder) => new PyPiExtract(options, sourceFinder || sourceDiscovery)
