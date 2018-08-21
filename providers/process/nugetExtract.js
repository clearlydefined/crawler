// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const fs = require('fs')
const { promisify } = require('util')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')
const { parseString } = require('xml2js')

class NuGetExtract extends BaseHandler {
  get schemaVersion() {
    return 1
  }

  get toolSpec() {
    return { tool: 'clearlydefined', toolVersion: this.schemaVersion }
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'nuget' && spec && spec.type === 'nuget'
  }

  // Coming in here we expect the request.document to have id, location and metadata properties.
  // Do interesting processing...
  async handle(request) {
    if (this.isProcessing(request)) {
      // skip all the hard work if we are just traversing.
      const { spec } = super._process(request)
      this.addBasicToolLinks(request, spec)
      const manifest = await this._getManifest(request.document.location.manifest)
      this.addSelfLink(request, manifest.id)
      await this._createDocument(request, manifest, request.document.registryData)
    }
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.adopt(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
    return request
  }

  async _getManifest(location) {
    const manifest = await promisify(fs.readFile)(location)
    return JSON.parse(manifest.toString())
  }

  async _getNuspec(location) {
    const nuspec = await promisify(fs.readFile)(location)
    return nuspec.toString()
  }

  async _createDocument(request, manifest, registryData) {
    const nuspecLocation = request.document.location.nuspec
    // setup the manifest to be the new document for the request
    request.document = { _metadata: request.document._metadata, manifest, registryData }
    // Add interesting info
    if (registryData && registryData.published)
      request.document.releaseDate = new Date(registryData.published).toISOString()
    const manifestCandidates = this._discoverCandidateSourceLocations(manifest)
    const nuspecXml = await this._getNuspec(nuspecLocation)
    const nuspec = await promisify(parseString)(nuspecXml, { trim: true, mergeAttrs: true, explicitArray: false })
    const nuspecCandidates = this._discoverCandidateSourceLocations(
      nuspec && nuspec.package ? nuspec.package.metadata : null
    )
    const candidates = [...manifestCandidates, ...nuspecCandidates]
    const sourceInfo = await sourceDiscovery(manifest.version, candidates, { githubToken: this.options.githubToken })
    if (sourceInfo) return (request.document.sourceInfo = sourceInfo)
  }

  _discoverCandidateSourceLocations(manifest) {
    const candidateUrls = []
    if (!manifest) return candidateUrls
    if (manifest.repository && manifest.repository.url) candidateUrls.push(manifest.repository.url)
    if (manifest.projectUrl) candidateUrls.push(manifest.projectUrl)
    if (manifest.licenseUrl) candidateUrls.push(manifest.licenseUrl)
    return candidateUrls
  }
}

module.exports = options => new NuGetExtract(options)
