// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')
const { get } = require('lodash')

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
      await this._createDocument(request, request.document.registryData)
      await BaseHandler.addInterestingFiles(request.document, location)
    }
    this.linkAndQueueTool(request, 'scancode')
    this.linkAndQueueTool(request, 'fossology')
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.fromObject(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
  }

  async _createDocument(request, registryData) {
    request.document = { _metadata: request.document._metadata, registryData }
    const sourceInfo = await this._discoverSource(registryData)
    if (sourceInfo) request.document.sourceInfo = sourceInfo
  }

  _discoverSource(registryData) {
    let sources = []

    // these options are mutually exclusive, sources will have a single item
    let httpSource = get(registryData, 'source.http')
    if (httpSource) sources.push(httpSource)

    let gitSource = get(registryData, 'source.git')
    if (gitSource) sources.push(gitSource)

    let svnSource = get(registryData, 'source.svn')
    if (svnSource) sources.push(svnSource)

    let hgSource = get(registryData, 'source.hg')
    if (hgSource) sources.push(hgSource)

    // sourceFinder will detect the source only using the version,
    // there is no way to pass the branch/tag/commit we have in the manifest
    return this.sourceFinder(registryData.version, sources, {
      githubToken: this.options.githubToken
    })
  }
}

module.exports = (options, sourceFinder) => new PodExtract(options, sourceFinder || sourceDiscovery)
