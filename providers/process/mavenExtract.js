// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')
const { get, merge } = require('lodash')

class MavenExtract extends AbstractClearlyDefinedProcessor {
  constructor(options, sourceFinder) {
    super(options)
    this.sourceFinder = sourceFinder
  }

  get toolVersion() {
    return '1.3.0'
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'maven' && spec && spec.type === 'maven'
  }

  // Coming in here we expect the request.document to have id, location and metadata properties.
  // Do interesting processing...
  async handle(request) {
    // skip all the hard work if we are just traversing.
    if (this.isProcessing(request)) {
      await super.handle(request)
      const spec = this.toSpec(request)
      const manifest = { summary: request.document.summary, poms: request.document.poms }
      await this._createDocument(request, spec, manifest, request.document.releaseDate)
    }
    this.addLocalToolTasks(request)
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.fromObject(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
    return request
  }

  _discoverCandidateSourceLocations(manifest) {
    const candidateUrls = []
    candidateUrls.push(get(manifest, 'summary.scm.0.url.0'))
    return candidateUrls.filter(e => e)
  }

  async _discoverSource(spec, manifest) {
    const manifestCandidates = this._discoverCandidateSourceLocations(manifest)
    // TODO lookup source discovery in a set of services that have their own configuration
    const githubSource = await this.sourceFinder(spec.revision, manifestCandidates, {
      githubToken: this.options.githubToken,
      logger: this.logger
    })
    if (githubSource) return githubSource
    // didn't find any source in GitHub so make up a sources url to try if the registry thinks there is source
    // Need to confirm the expectations here.
    const result = SourceSpec.fromObject(spec)
    result.type = 'sourcearchive'
    return result
  }

  async _createDocument(request, spec, manifest, releaseDate) {
    request.document = merge(this.clone(request.document), { manifest, releaseDate })
    // Add source info
    const sourceInfo = await this._discoverSource(spec, manifest)
    if (sourceInfo) request.document.sourceInfo = sourceInfo
  }
}

module.exports = (options, sourceFinder) => new MavenExtract(options, sourceFinder || sourceDiscovery)
