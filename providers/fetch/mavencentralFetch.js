// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
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

const providerMap = {
  mavencentral: 'https://search.maven.org/remotecontent?filepath='
}
const extensionMap = {
  sourcesJar: '-sources.jar',
  pom: '.pom',
  aar: '.aar',
  jar: '.jar'
}

class MavenFetch extends AbstractFetch {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'mavencentral'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    if (!spec.revision) spec.revision = await this._getLatestVersion(spec)
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

  // query maven to get the latest version if we don't already have that.
  // Example: https://search.maven.org/solrsearch/select?q=g:%22org.eclipse%22+AND+a:%22swt%22+AND+v:%223.3.0-v3346%22&rows=1&wt=json
  async _getLatestVersion(spec) {
    const url = `https://search.maven.org/solrsearch/select?q=g:"${spec.namespace}"+AND+a:"${spec.name}"&rows=1&wt=json`
    const response = await requestPromise({ url, json: true })
    return get(response, 'response.docs[0].latestVersion')
  }

  _createDocument(dir, releaseDate, hashes, poms, summary) {
    return { location: dir.name, releaseDate, hashes, poms, summary }
  }

  _buildUrl(spec, extension = extensionMap.jar) {
    const fullName = `${spec.namespace}/${spec.name}`.replace(/\./g, '/')
    return `${providerMap[spec.provider]}${fullName}/${spec.revision}/${spec.name}-${spec.revision}${extension}`
  }

  async _getArtifact(spec, destination) {
    const extensions = spec.type === 'sourcearchive' ? [extensionMap.sourcesJar] : [extensionMap.jar, extensionMap.aar]
    for (let extension of extensions) {
      const url = this._buildUrl(spec, extension)
      const status = await new Promise(resolve => {
        nodeRequest
          .get(url, (error, response) => {
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
    const parentSpec = this._buildParentSpec(pom)
    if (parentSpec) await this._getPoms(parentSpec, result)
    if (pom) result.push(pom)
    return result
  }

  async _getPom(spec) {
    const url = this._buildUrl(spec, extensionMap.pom)
    let content
    try {
      content = await requestPromise({ url, json: false })
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
        const releaseDate = new Date(line.slice(1))
        if (!isNaN(releaseDate.getTime())) return releaseDate.toISOString()
      }
    }
    const url = `https://search.maven.org/solrsearch/select?q=g:"${spec.namespace}"+AND+a:"${spec.name}"&rows=1&wt=json`
    const response = await requestPromise({ url, json: true })
    const timestamp = get(response, 'response.docs[0].timestamp')
    if (timestamp) return new Date(timestamp).toISOString()
  }
}

module.exports = options => new MavenFetch(options)
