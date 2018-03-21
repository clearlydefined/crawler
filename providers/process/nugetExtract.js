// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const requestRetry = require('requestretry').defaults({ maxAttempts: 3, fullResponse: true })
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')

class NugetExtract extends BaseHandler {
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
    const { body, statusCode } = await requestRetry.get(location, { json: true })
    if (statusCode !== 200) return null
    return body
  }

  async _createDocument(request, spec, manifest, registryData) {
    // setup the manifest to be the new document for the request
    request.document = { _metadata: request.document._metadata, manifest, registryData }
    // Add interesting info
    if (registryData.published) request.document.releaseDate = new Date(registryData.published).toISOString()
    const manifestCandidates = this._discoverCandidateSourceLocations(manifest)
    const nuspecCandidates = await this._discoverCandidateSourceLocationsFromNuspec(spec)
    const candidates = [...new Set([...manifestCandidates, ...nuspecCandidates])]
    const sourceInfo = await sourceDiscovery(spec.revision, candidates, { githubToken: this.options.githubToken })
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

  // For some reason catalogEntry API is not able to parse repository URL, so nuspec XML is needed ("repository": "" instead of <repository type="git" url="https://github.com/castleproject/Core"/>)
  async _discoverCandidateSourceLocationsFromNuspec(spec) {
    // https://docs.microsoft.com/en-us/nuget/api/package-base-address-resource#download-package-manifest-nuspec
    // Example: https://api.nuget.org/v3-flatcontainer/newtonsoft.json/11.0.1/newtonsoft.json.nuspec
    const { body, statusCode } = await requestRetry.get(
      `https://api.nuget.org/v3-flatcontainer/${spec.name}/${spec.revision}/${spec.name}.nuspec`
    )
    if (statusCode !== 200) return []
    const matched = body.match(/https:\/\/github.com\/.*["<]{1}/g) || []
    return matched.map(url => url.substring(0, url.length - 1))
  }
}

module.exports = options => new NugetExtract(options)
