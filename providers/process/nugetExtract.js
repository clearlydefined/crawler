// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const fs = require('fs')
const { promisify } = require('util')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')
const { parseString } = require('xml2js')
const { get, merge } = require('lodash')

class NuGetExtract extends AbstractClearlyDefinedProcessor {
  constructor(options, sourceFinder) {
    super(options)
    this.sourceFinder = sourceFinder
  }

  get schemaVersion() {
    return '1.2.0'
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
    // skip all the hard work if we are just traversing.
    if (this.isProcessing(request)) {
      const { location, metadataLocation } = request.document
      await super.handle(request, location)
      const manifest = await this._getManifest(metadataLocation.manifest)
      await this._createDocument(request, manifest, request.document.registryData)
    }
    this.linkAndQueueTool(request, 'licensee')
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.fromObject(request.document.sourceInfo)
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
    const nuspecXml = nuspec.toString()
    return promisify(parseString)(nuspecXml, { trim: true, mergeAttrs: true, explicitArray: false })
  }

  async _createDocument(request, manifest, registryData) {
    const originalDocument = request.document
    // setup the manifest to be the new document for the request
    request.document = merge(this.clone(request.document), { manifest, registryData })
    // Add interesting info
    if (registryData && registryData.published)
      request.document.releaseDate = new Date(registryData.published).toISOString()
    // Add source info
    const nuspec = await this._getNuspec(originalDocument.metadataLocation.nuspec)
    const sourceInfo = await this._discoverSource(manifest, nuspec)
    if (sourceInfo) request.document.sourceInfo = sourceInfo
  }

  async _discoverSource(manifest, nuspec) {
    const manifestCandidates = this._discoverCandidateSourceLocations(manifest)
    const nuspecCandidates = this._discoverCandidateSourceLocations(get(nuspec, 'package.metadata'))
    const candidates = [...manifestCandidates, ...nuspecCandidates]
    return this.sourceFinder(manifest.version, candidates, {
      githubToken: this.options.githubToken
    })
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

module.exports = (options, sourceFinder) => new NuGetExtract(options, sourceFinder || sourceDiscovery)
