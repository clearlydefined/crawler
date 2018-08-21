// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const fs = require('fs')
const path = require('path')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')
const { get } = require('lodash')

class NpmExtract extends BaseHandler {
  get schemaVersion() {
    return '1.1.0'
  }

  get toolSpec() {
    return { tool: 'clearlydefined', toolVersion: this.schemaVersion }
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'npm' && spec && spec.type === 'npm'
  }

  // Coming in here we expect the request.document to have id, location and metadata properties.
  // Do interesting processing...
  async handle(request) {
    if (this.isProcessing(request)) {
      // skip all the hard work if we are just traversing.
      const { document, spec } = super._process(request)
      this.addBasicToolLinks(request, spec)
      const location = request.document.location
      const manifestLocation = this._getManifestLocation(location)
      const manifest = manifestLocation ? JSON.parse(fs.readFileSync(manifestLocation)) : null
      if (!manifest) console.log(`NPM without package.json: ${request.url}`)
      this.addSelfLink(request, request.document.registryData.name)
      this._createDocument(request, manifest, request.document.registryData)
      await BaseHandler.addInterestingFiles(request.document, path.join(location, 'package'))
    }
    this.linkAndQueueTool(request, 'scancode')
    this.linkAndQueueTool(request, 'fossology')
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.adopt(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
    return request
  }

  _getManifestLocation(dir) {
    if (fs.existsSync(path.join(dir, 'package/package.json'))) return path.join(dir, 'package/package.json')
    if (fs.existsSync(path.join(dir, 'package.json'))) return path.join(dir, 'package.json')
    return null
  }

  _discoverCandidateSourceLocations(manifest) {
    const candidateUrls = []
    if (!manifest) return candidateUrls
    candidateUrls.push(get(manifest, 'repository.url'))
    candidateUrls.push(get(manifest, 'url'))
    candidateUrls.push(get(manifest, 'homepage'))
    if (manifest.bugs) {
      if (typeof manifest.bugs === 'string' && manifest.bugs.startsWith('http')) candidateUrls.push(manifest.bugs)
      else candidateUrls.push(manifest.bugs.url)
    }
    return candidateUrls.filter(e => e)
  }

  async _discoverSource(manifest, registryManifest) {
    // Add interesting info
    const manifestCandidates = this._discoverCandidateSourceLocations(manifest)
    const registryCandidates = this._discoverCandidateSourceLocations(registryManifest)
    const candidates = [...manifestCandidates, ...registryCandidates]
    // TODO lookup source discovery in a set of services that have their own configuration
    return sourceDiscovery(registryManifest.version, candidates, { githubToken: this.options.githubToken })
  }

  async _createDocument(request, manifest, registryData) {
    // setup the manifest to be the new document for the request
    request.document = { _metadata: request.document._metadata, 'package.json': manifest, registryData }
    const sourceInfo = await this._discoverSource(manifest, registryData.manifest)
    if (sourceInfo) request.document.sourceInfo = sourceInfo
  }
}

module.exports = options => new NpmExtract(options)
