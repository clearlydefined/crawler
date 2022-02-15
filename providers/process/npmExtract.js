// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const fs = require('fs')
const path = require('path')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')
const { get, isArray, merge } = require('lodash')

class NpmExtract extends AbstractClearlyDefinedProcessor {
  constructor(options, sourceFinder) {
    super(options)
    this.sourceFinder = sourceFinder
  }

  get toolVersion() {
    return '1.1.4'
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'npm' && spec && spec.type === 'npm'
  }

  // Coming in here we expect the request.document to have id, location and metadata properties.
  // Do interesting processing...
  async handle(request) {
    // skip all the hard work if we are just traversing.
    if (this.isProcessing(request)) {
      const location = request.document.location
      await super.handle(request, location, 'package')
      const manifestLocation = this._getManifestLocation(location)
      const manifest = manifestLocation ? JSON.parse(fs.readFileSync(path.join(location, manifestLocation))) : null
      await this._createDocument(request, manifest, request.document.registryData)
      if (manifest) this.attachFiles(request.document, [manifestLocation], location)
      else this.logger.info('NPM without package.json', { url: request.url })
    }
    this.linkAndQueueTool(request, 'licensee')
    // this.linkAndQueueTool(request, 'fossology')
    this.linkAndQueueTool(request, 'scancode')
    this.linkAndQueueTool(request, 'reuse')
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.fromObject(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
    return request
  }

  _getManifestLocation(dir) {
    if (fs.existsSync(path.join(dir, 'package/package.json'))) return 'package/package.json'
    if (fs.existsSync(path.join(dir, 'package.json'))) return 'package.json'
    return null
  }

  _discoverCandidateSourceLocations(manifest) {
    const candidateUrls = []
    if (!manifest) return candidateUrls
    candidateUrls.push(get(manifest, 'repository.url'))
    candidateUrls.push(get(manifest, 'url'))
    let homepage = get(manifest, 'homepage')
    if (homepage && isArray(homepage)) homepage = homepage[0]
    candidateUrls.push(homepage)
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
    request.document = merge(this.clone(request.document), { 'package.json': manifest, registryData })
    const sourceInfo = await this._discoverSource(manifest, registryData.manifest)
    if (sourceInfo) request.document.sourceInfo = sourceInfo
  }
}

module.exports = (options, sourceFinder) => new NpmExtract(options, sourceFinder || sourceDiscovery)
