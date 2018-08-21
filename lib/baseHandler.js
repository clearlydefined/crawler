// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const tmp = require('tmp')
const semver = require('semver')
const EntitySpec = require('../lib/entitySpec')
const extract = require('extract-zip')
const decompress = require('decompress')
const fs = require('fs')
const path = require('path')
const glob = require('glob')
const shajs = require('sha.js')

tmp.setGracefulCleanup()
const tmpOptions = {
  unsafeCleanup: true,
  template: (process.platform === 'win32' ? 'c:/temp/' : '/tmp/') + 'cd-XXXXXX'
}

function buildGlob(roots) {
  const parts = []
  roots.forEach(root => {
    parts.push(root)
    parts.push(`${root}.{md,txt,html}`)
  })
  return `+(${parts.join('|')})`
}

class BaseHandler {
  constructor(options) {
    this.options = options
    this.logger = options.logger
  }

  static computeToken(content) {
    return shajs('sha256')
      .update(content)
      .digest('hex')
  }

  static addInterestingFiles(document, location) {
    if (!location && location !== '') return null
    return new Promise((resolve, reject) => {
      glob(
        buildGlob(['license', 'notice', 'notices']),
        { cwd: location, nocase: true, nodir: true },
        (error, files) => {
          if (error) reject(error)
          if (files.length === 0) return resolve(null)
          Object.defineProperty(document, '_attachments', { value: [], enumerable: false })
          document.interestingFiles = files.map(file => {
            const attachment = fs.readFileSync(path.join(location, file), 'utf8')
            const token = BaseHandler.computeToken(attachment)
            document._attachments.push({ path: file, token, attachment })
            return { path: file, token }
          })
          resolve()
        }
      )
    })
  }

  get tmpOptions() {
    const tmpBase = this.options.tempLocation || (process.platform === 'win32' ? 'c:/temp/' : '/tmp/')
    return {
      unsafeCleanup: true,
      template: tmpBase + 'cd-XXXXXX'
    }
  }

  shouldFetch(request) {
    return true
  }

  canHandle(request) {
    return false
  }

  shouldProcess(request) {
    return request.policy.shouldProcess(request, this.schemaVersion)
  }

  shouldTraverse(request) {
    return request.policy.shouldTraverse(request)
  }

  isProcessing(request) {
    return request.processMode === 'process'
  }

  _process(request) {
    request.document._metadata.version = this.schemaVersion || 1
    return { document: request.document, spec: this.toSpec(request) }
  }

  _createTempFile(request) {
    const result = tmp.fileSync(tmpOptions)
    request.trackCleanup(result.removeCallback)
    return result
  }

  _createTempDir(request) {
    const result = tmp.dirSync(tmpOptions)
    request.trackCleanup(result.removeCallback)
    return result
  }

  unzip(source, destination) {
    return new Promise((resolve, reject) =>
      extract(source, { dir: destination }, error => (error ? reject(error) : resolve()))
    )
  }

  decompress(source, destination) {
    return decompress(source, destination)
  }

  toSpec(request) {
    return EntitySpec.fromUrl(request.url)
  }

  getLatestVersion(versions) {
    if (!Array.isArray(versions)) return versions
    if (versions.length === 0) return null
    if (versions.length === 1) return versions[0]
    return versions
      .filter(v => !this.isPreReleaseVersion(v))
      .reduce((max, current) => (semver.gt(current, max) ? current : max), versions[0])
  }

  isPreReleaseVersion(version) {
    return semver.prerelease(version) !== null
  }

  link(request, name, spec) {
    request.linkResource(name, spec.toUrn())
  }

  addSelfLink(request, preservedName = null) {
    request.linkResource('self', this.getUrnFor(request, preservedName))
  }

  addBasicToolLinks(request, spec) {
    // create a new URN for the tool siblings. This should not have a version but should have the tool name
    const newSpec = new EntitySpec(spec.type, spec.provider, spec.namespace, spec.name, spec.revision, spec.tool)
    newSpec.tool = newSpec.tool || this.toolSpec.tool
    delete newSpec.toolVersion
    request.linkSiblings(newSpec.toUrn())
  }

  getUrnFor(request, preservedName = null) {
    const spec = this.toSpec(request)
    if (preservedName) spec.name = preservedName
    const newSpec = Object.assign(Object.create(spec), spec, this.toolSpec)
    return newSpec.toUrn()
  }

  linkAndQueue(request, name, spec = null) {
    spec = spec || this.toSpec(request)
    request.linkResource(name, spec.toUrn())
    request.queue(name, spec.toUrl(), request.getNextPolicy(name))
  }

  linkAndQueueTool(request, name, tool = name) {
    const spec = this.toSpec(request)
    const url = spec.toUrl()
    spec.tool = tool
    const urn = spec.toUrn()
    request.linkCollection(name, urn)
    request.queue(tool, url, request.getNextPolicy(name))
  }
}

module.exports = BaseHandler
