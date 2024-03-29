// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const fs = require('fs')
const path = require('path')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')
const { get, merge } = require('lodash')

class ComposerExtract extends AbstractClearlyDefinedProcessor {
  constructor(options, sourceFinder) {
    super(options)
    this.sourceFinder = sourceFinder
  }

  get toolVersion() {
    return '1.0.0'
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'composer' && spec && spec.type === 'composer'
  }

  // Coming in here we expect the request.document to have id, location and metadata properties.
  // Do interesting processing...
  async handle(request) {
    // skip all the hard work if we are just traversing.
    if (this.isProcessing(request)) {
      const location = request.document.location
      const dirRoot = request.document.dirRoot
      await super.handle(request, location, dirRoot)
      const manifestLocation = this._getManifestLocation(location, dirRoot)
      const manifest = manifestLocation ? JSON.parse(fs.readFileSync(path.join(location, manifestLocation))) : null
      await this._createDocument(request, manifest, request.document.registryData)
      if (manifest) this.attachFiles(request.document, [manifestLocation], location)
      else this.logger.info('PHP package without composer.json', { url: request.url })
    }
    this.addLocalToolTasks(request)
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.fromObject(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
    return request
  }

  _getManifestLocation(dir, dirRoot) {
    if (fs.existsSync(path.join(dir, `${dirRoot}/composer.json`))) return `${dirRoot}/composer.json`
    if (fs.existsSync(path.join(dir, 'composer.json'))) return 'composer.json'
    return null
  }

  _discoverCandidateSourceLocations(manifest) {
    const candidateUrls = []
    if (!manifest) return candidateUrls
    candidateUrls.push(get(manifest, 'source.url'))
    candidateUrls.push(get(manifest, 'dist.url'))
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
    return this.sourceFinder(registryManifest.version, candidates, {
      githubToken: this.options.githubToken,
      logger: this.logger
    })
  }

  async _createDocument(request, manifest, registryData) {
    // setup the manifest to be the new document for the request
    request.document = merge(this.clone(request.document), { 'composer.json': manifest, registryData })
    const sourceInfo = await this._discoverSource(manifest, registryData.manifest)
    if (sourceInfo) request.document.sourceInfo = sourceInfo
  }
}

module.exports = (options, sourceFinder) => new ComposerExtract(options, sourceFinder || sourceDiscovery)
