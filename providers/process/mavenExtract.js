// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const fs = require('fs')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')
const parseString = require('xml2js').parseString

class MavenExtract extends BaseHandler {
  get schemaVersion() {
    return 1
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
    if (this.isProcessing(request)) {
      // skip all the hard work if we are just traversing.
      const { spec } = super._process(request)
      this.addBasicToolLinks(request, spec)
      const manifest = await this._getManifest(request.document.location)
      await this._createDocument(request, spec, manifest, request.document.registryData)
    }
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.adopt(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
    return request
  }

  async _getManifest(location) {
    const manifestContent = fs.readFileSync(location)
    return await new Promise((resolve, reject) =>
      parseString(manifestContent, (error, result) => (error ? reject(error) : resolve(result)))
    )
  }

  _discoverCandidateSourceLocations(manifest) {
    const candidateUrls = []
    if (manifest.project && manifest.project.scm) candidateUrls.push(manifest.project.scm.url)
    return candidateUrls
  }

  async _discoverSource(version, locations) {
    // TODO lookup source discovery in a set of services that have their own configuration
    return sourceDiscovery(version, locations, { githubToken: this.options.githubToken })
  }

  async _createDocument(request, spec, manifest, registryData) {
    // setup the manifest to be the new document for the request
    request.document = { _metadata: request.document._metadata, manifest, registryData }
    // Add interesting info
    if (registryData.timestamp) request.document.releaseDate = new Date(registryData.timestamp).toISOString()

    const manifestCandidates = this._discoverCandidateSourceLocations(manifest)
    const sourceInfo = await this._discoverSource(spec.revision, [...manifestCandidates])
    if (sourceInfo) return (request.document.sourceInfo = sourceInfo)

    // didn't find any source so make up a sources url to try if the registry thinks there is source
    if (!registryData.ec.includes('-sources.jar')) return
    const mavenSourceInfo = {
      type: 'sourcearchive',
      provider: 'mavencentral',
      url: `${spec.namespace}/${spec.name}`,
      revision: spec.revision
    }
    request.document.sourceInfo = mavenSourceInfo
  }
}

module.exports = options => new MavenExtract(options)
