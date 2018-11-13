// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const mavenCentral = require('../../lib/mavenCentral')
const requestPromise = require('request-promise-native')
const { clone } = require('lodash')

class MavenFetch extends BaseHandler {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'mavencentral'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    const registryData = await this._getRegistryData(spec)
    if (!registryData) return request.markSkip('Missing  ')
    spec.revision = spec.revision ? registryData.v : registryData.latestVersion
    // rewrite the request URL as it is used throughout the system to derive locations and urns etc.
    request.url = spec.toUrl()
    const file = this._createTempFile(request)
    const code = await this._getArtifact(spec, file.name)
    if (code === 404) return request.markSkip('Missing  ')
    const location = await this._postProcessArtifact(request, spec, file)
    request.document = this._createDocument(location, registryData)
    request.contentOrigin = 'origin'
    if (registryData.g || registryData.a) {
      request.casedSpec = clone(spec)
      request.casedSpec.namespace = registryData.g || spec.namespace
      request.casedSpec.name = registryData.a || spec.name
    }
    return request
  }

  async _postProcessArtifact(request, spec, file) {
    if (spec.type !== 'sourcearchive') return file
    const dir = this._createTempDir(request)
    await this.decompress(file.name, dir.name) // Warning: may not clean files up on Windows due to a bug. Switch back to unzip once https://github.com/maxogden/extract-zip/issues/65 is resolved
    return dir
  }

  async _getArtifact(spec, destination) {
    if (spec.type === 'sourcearchive') return await mavenCentral.fetchSourcesJar(spec, destination)
    else return await mavenCentral.fetchPom(spec, destination)
  }

  // query maven to get the latest version if we don't already have that.
  async _getRegistryData(spec) {
    const versionClause = spec.revision ? `+AND+v:"${spec.revision}"` : ''
    const url = `https://search.maven.org/solrsearch/select?q=g:"${spec.namespace}"+AND+a:"${
      spec.name
    }"${versionClause}&rows=1&wt=json`
    const packageInfo = await requestPromise({ url, json: true })
    if (!packageInfo.response.docs.length === 0) return null
    return packageInfo.response.docs[0]
  }

  _createDocument(location, registryData) {
    const releaseDate = new Date(registryData.timestamp).toISOString()
    return { location: location.name, registryData, releaseDate }
  }
}

module.exports = options => new MavenFetch(options)
