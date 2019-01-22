// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const requestPromise = require('request-promise-native')
const nodeRequest = require('request')
const { clone, get } = require('lodash')
const fs = require('fs')
const { promisify } = require('util')
const parseString = promisify(require('xml2js').parseString)
const EntitySpec = require('../../lib/entitySpec')

const providerMap = {
  mavencentral: 'https://search.maven.org/remotecontent?filepath='
}
const extensionMap = { sourcearchive: '-sources.jar', pom: '.pom', jar: '.jar', maven: '.jar' }

class MavenFetch extends AbstractFetch {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'mavencentral'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    const registryData = get(await this._getRegistryData(spec), 'response.docs[0]')
    if (!registryData) return this.markSkip(request)
    spec.revision = spec.revision ? registryData.v : registryData.latestVersion
    // rewrite the request URL as it is used throughout the system to derive locations and urns etc.
    request.url = spec.toUrl()
    super.handle(request)
    const poms = await this._getPoms(spec)
    if (!poms.length) return this.markSkip(request)
    const artifact = this.createTempFile(request)
    const code = await this._getArtifact(spec, artifact.name)
    if (code === 404) return this.markSkip(request)
    const dir = this.createTempDir(request)
    // Warning: may not clean files up on Windows due to a bug. Switch back to unzip once https://github.com/maxogden/extract-zip/issues/65 is resolved
    await this.decompress(artifact.name, dir.name)
    const hashes = await this.computeHashes(artifact.name)
    request.document = this._createDocument(dir, registryData, hashes, poms)
    request.contentOrigin = 'origin'
    if (registryData.g || registryData.a) {
      request.casedSpec = clone(spec)
      request.casedSpec.namespace = registryData.g || spec.namespace
      request.casedSpec.name = registryData.a || spec.name
    }
    return request
  }

  // query maven to get the latest version if we don't already have that.
  // Example: https://search.maven.org/solrsearch/select?q=g:%22org.eclipse%22+AND+a:%22swt%22+AND+v:%223.3.0-v3346%22&rows=1&wt=json
  async _getRegistryData(spec) {
    const versionClause = spec.revision ? `+AND+v:"${spec.revision}"` : ''
    const url = `https://search.maven.org/solrsearch/select?q=g:"${spec.namespace}"+AND+a:"${
      spec.name
    }"${versionClause}&rows=1&wt=json`
    return await requestPromise({ url, json: true })
  }

  _createDocument(dir, registryData, hashes, poms) {
    const releaseDate = new Date(registryData.timestamp).toISOString()
    return { location: dir.name, registryData, releaseDate, hashes, poms }
  }

  _buildUrl(spec, type = spec.type) {
    const extension = extensionMap[type]
    if (!extension) throw new Error(`Invalid spec: ${spec.toString()}`)
    const fullName = `${spec.namespace}/${spec.name}`.replace(/\./g, '/')
    return `${providerMap[spec.provider]}${fullName}/${spec.revision}/${spec.name}-${spec.revision}${extension}`
  }

  _getArtifact(spec, destination, type = spec.type) {
    const url = this._buildUrl(spec, type)
    return new Promise((resolve, reject) => {
      nodeRequest
        .get(url, (error, response) => {
          if (error) return reject(error)
          if (response.statusCode === 404) resolve(response.statusCode)
          if (response.statusCode !== 200) reject(new Error(`${response.statusCode} ${response.statusMessage}`))
        })
        .pipe(fs.createWriteStream(destination).on('finish', () => resolve(null)))
    })
  }

  async _getPoms(spec, result = []) {
    const pom = await this._getPom(spec)
    const parentSpec = this._buildParentSpec(pom)
    if (parentSpec) await this._getPoms(parentSpec, result)
    result.push(pom)
    return result
  }

  async _getPom(spec) {
    const url = this._buildUrl(spec, 'pom')
    const content = await requestPromise({ url, json: false })
    const pom = await parseString(content)
    // clean up some stuff we don't actually look at.
    delete pom.project.build
    delete pom.project.dependencies
    delete pom.project.dependencyManagement
    delete pom.project.modules
    delete pom.project.profiles
    return pom
  }

  _buildParentSpec(pom) {
    if (!pom || !pom.project || !pom.project.parent) return null
    const parent = pom.project.parent[0]
    return new EntitySpec(
      'maven',
      'mavencentral',
      parent.groupId[0].trim(),
      parent.artifactId[0].trim(),
      parent.version[0].trim()
    )
  }
}

module.exports = options => new MavenFetch(options)
