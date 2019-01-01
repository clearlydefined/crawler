// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const EntitySpec = require('../../lib/entitySpec')
const fs = require('fs')
const mavencentralFetch = require('../fetch/mavencentralFetch')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')
const parseString = require('xml2js').parseString
const { get } = require('lodash')

class MavenExtract extends AbstractClearlyDefinedProcessor {
  constructor(options, sourceFinder) {
    super(options)
    this.sourceFinder = sourceFinder
  }

  get schemaVersion() {
    return '1.1.2'
  }

  get toolSpec() {
    return { tool: 'clearlydefined', toolVersion: this.schemaVersion }
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
      const manifest = { summary: this._mergePoms(request.document.poms), poms: request.document.poms }
      await this._createDocument(request, spec, manifest, request.document.registryData)
    }
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.fromObject(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
    return request
  }

  _mergePoms(poms) {
    if (!poms) return null
    return [...poms].reverse().reduce((result, pom) => {
      return { ...result, ...pom.project }
    }, {})
  }

  _discoverCandidateSourceLocations(manifest) {
    const candidateUrls = []
    candidateUrls.push(get(manifest, 'project.scm.url'))
    return candidateUrls.filter(e => e)
  }

  async _discoverSource(spec, manifest, registryData) {
    const manifestCandidates = this._discoverCandidateSourceLocations(manifest)
    // TODO lookup source discovery in a set of services that have their own configuration
    const githubSource = await this.sourceFinder(spec.version, manifestCandidates, {
      githubToken: this.options.githubToken
    })
    if (githubSource) return githubSource
    // didn't find any source in GitHub so make up a sources url to try if the registry thinks there is source
    // TODO could check `registryData.ec.includes('-sources.jar')` but there seemed to be examples where
    // the registry did not think it had the sources jar but it did. So Just make it up here and we'll try.
    // Need to confirm the expectations here.
    const result = SourceSpec.fromObject(spec)
    result.type = 'sourcearchive'
    return result
  }

  async _createDocument(request, spec, manifest, registryData) {
    // setup the manifest to be the new document for the request
    request.document = { ...this.clone(request.document), manifest, registryData }
    // Add interesting info
    if (registryData.timestamp) request.document.releaseDate = new Date(registryData.timestamp).toISOString()
    // Add source info
    const sourceInfo = await this._discoverSource(spec, manifest, registryData)
    if (sourceInfo) request.document.sourceInfo = sourceInfo
  }
}

module.exports = (options, sourceFinder) => new MavenExtract(options, sourceFinder || sourceDiscovery)
