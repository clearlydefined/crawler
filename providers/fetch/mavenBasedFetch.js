// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const requestPromise = require('request-promise-native')
const nodeRequest = require('request')
const { clone, get } = require('lodash')
const { promisify } = require('util')
const fs = require('fs')
const exists = promisify(fs.exists)
const path = require('path')
const parseString = promisify(require('xml2js').parseString)
const EntitySpec = require('../../lib/entitySpec')
const { extractDate } = require('../../lib/utils')

const extensionMap = {
  sourcesJar: '-sources.jar',
  pom: '.pom',
  aar: '.aar',
  jar: '.jar'
}

const defaultHeaders = { headers: { 'User-Agent': 'clearlydefined.io crawler (clearlydefined@outlook.com)' } }

class MavenBasedFetch extends AbstractFetch {
  constructor(options, providerMap) {
    super(options)
    this._providerMap = { ...providerMap }
    this._requestPromise = options.requestPromise || requestPromise.defaults(defaultHeaders)
    this._requestStream = options.requestStream || nodeRequest.defaults(defaultHeaders).get
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return !!this._providerMap[spec?.provider]
  }

  async handle(request) {
    const spec = await this._processCoordinates(this.toSpec(request))
    if (!spec.revision) return this.markSkip(request)
    // rewrite the request URL as it is used throughout the system to derive locations and urns etc.
    request.url = spec.toUrl()
    super.handle(request)
    const poms = await this._getPoms(spec)
    if (!poms.length) return this.markSkip(request)
    const summary = this._mergePoms(poms)
    const artifact = this.createTempFile(request)
    const artifactResult = await this._getArtifact(spec, artifact.name)
    if (!artifactResult) return this.markSkip(request)
    const dir = this.createTempDir(request)
    await this.decompress(artifact.name, dir.name)
    const hashes = await this.computeHashes(artifact.name)
    const releaseDate = await this._getReleaseDate(dir.name, spec)
    request.document = this._createDocument(dir, releaseDate, hashes, poms, summary)
    request.contentOrigin = 'origin'
    if (get(summary, 'groupId[0]') || get(summary, 'artifactId[0]')) {
      request.casedSpec = clone(spec)
      request.casedSpec.namespace = get(summary, 'groupId[0]') || spec.namespace
      request.casedSpec.name = get(summary, 'artifactId[0]') || spec.name
    }
    return request
  }

  async _processCoordinates(spec) {
    if (spec.revision) return spec
    const latestRelease = await this._getLatestVersion(spec)
    return latestRelease ? EntitySpec.fromObject({ ...spec, revision: latestRelease }) : spec
  }

  async _getLatestVersion() {
    return undefined
  }

  _createDocument(dir, releaseDate, hashes, poms, summary) {
    return { location: dir.name, releaseDate, hashes, poms, summary }
  }

  _buildBaseUrl(spec) {
    const fullName = `${spec.namespace.replace(/\./g, '/')}/${spec.name}`
    return `${this._providerMap[spec.provider]}${fullName}`
  }

  _buildUrl(spec, extension = extensionMap.jar) {
    return `${this._buildBaseUrl(spec)}/${spec.revision}/${spec.name}-${spec.revision}${extension}`
  }

  _getArtifactExtensions(spec) {
    return spec.type === 'sourcearchive' ? [extensionMap.sourcesJar] : [extensionMap.jar, extensionMap.aar]
  }

  async _getArtifact(spec, destination) {
    const extensions = this._getArtifactExtensions(spec)
    for (let extension of extensions) {
      const url = this._buildUrl(spec, extension)
      const status = await new Promise(resolve => {
        this._requestStream(url, (error, response) => {
          if (error) this.logger.error(error)
          if (response.statusCode !== 200) return resolve(false)
        })
          .pipe(fs.createWriteStream(destination).on('finish', () => resolve(true)))
      })
      if (status) return true
    }
    return false
  }

  async _getPoms(spec, result = []) {
    const pom = await this._getPom(spec)
    const parentSpec = this._buildParentSpec(pom, spec)
    if (parentSpec) await this._getPoms(parentSpec, result)
    if (pom) result.push(pom)
    return result
  }

  async _getPom(spec) {
    const url = this._buildUrl(spec, extensionMap.pom)
    let content
    try {
      content = await this._requestPromise({ url, json: false })
    } catch (error) {
      if (error.statusCode === 404) return null
      else throw error
    }
    const pom = await parseString(content)
    // clean up some stuff we don't actually look at.
    delete pom.project.build
    delete pom.project.dependencies
    delete pom.project.dependencyManagement
    delete pom.project.modules
    delete pom.project.profiles
    return pom
  }

  _buildParentSpec(pom, spec) {
    if (!pom || !pom.project || !pom.project.parent) return null
    const parent = pom.project.parent[0]
    return new EntitySpec(
      spec.type,
      spec.provider,
      parent.groupId[0].trim(),
      parent.artifactId[0].trim(),
      parent.version[0].trim()
    )
  }

  _mergePoms(poms) {
    if (!poms) return null
    return [...poms].reduce((result, pom) => {
      return { ...result, ...pom.project }
    }, {})
  }

  async _getReleaseDate(dirName, spec) {
    const location = path.join(dirName, `META-INF/${spec.type}/${spec.namespace}/${spec.name}/pom.properties`)
    if (await exists(location)) {
      const pomProperties = (await promisify(fs.readFile)(location)).toString().split('\n')
      for (const line of pomProperties) {
        const releaseDate = extractDate(line.slice(1))
        if (releaseDate) return releaseDate.toJSDate().toISOString()
      }
    }
  }
}

module.exports = MavenBasedFetch
