// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const EntitySpec = require('../../lib/entitySpec')
const fs = require('fs')
const path = require('path')
const shajs = require('sha.js')
const { intersection, pick, set } = require('lodash')
const { promisify } = require('util')
const nodeDir = promisify(require('node-dir').files)
const { trimAllParents } = require('../../lib/utils')

class AbstractProcessor extends BaseHandler {
  get schemaVersion() {
    return '0.1.0'
  }

  _computeToken(content) {
    return shajs('sha256')
      .update(content)
      .digest('hex')
  }

  /**
   * Attach the files at the given `paths` (relative to the identified `location`) to the document
   *
   * @param {Object} document - The document to host the attachments
   * @param {[string]} files - Relative paths to the attachment files
   * @param {string} location - Root filesystem path that hosts the files to be attached
   */
  attachFiles(document, files, location = '') {
    if (!files || !files.length) return
    if (!document._attachments) Object.defineProperty(document, '_attachments', { value: [], enumerable: false })
    document.attachments = document.attachments || []
    files.forEach(file => {
      const fullPath = path.join(location, file)
      const attachment = fs.readFileSync(fullPath, 'utf8')
      const token = this._computeToken(attachment)
      // Stash the actual content on a hidden prop on the document and note the file in the list of attachments
      document._attachments.push({ path: file, token, attachment })
      document.attachments.push({ path: file, token })
    })
  }

  /**
   * Get the list of all files in the filesytem under the given location
   * @param {String} location - file system location to search
   * @returns {String[]} - full file system paths of all files found
   */
  getFiles(location) {
    // TODO: remove this line once location is always a directory (maven)
    if (!fs.statSync(location).isDirectory()) return []
    return nodeDir(location)
  }

  /**
   * Find all the files that are thought to be interesting relative to location.
   * @param {String} location - file system location to search
   * @returns {String[]} - location-relative paths of interesting files found. Note that all paths
   * are normalized to use '/' as the separator
   */
  async filterFiles(location) {
    const fullList = await this.getFiles(location)
    const exclusions = ['.git']
    const filteredList = fullList.filter(file => {
      if (!file) return false
      const segments = file.split(/[\\/]/g)
      return !intersection(segments, exclusions).length
    })
    return trimAllParents(filteredList, location)
  }

  shouldFetch() {
    return true
  }

  canHandle() {
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

  handle(request) {
    set(request, 'document._metadata.version', this.schemaVersion || 1)
    const spec = this.toSpec(request)
    this.addBasicToolLinks(request, spec)
  }

  clone(document) {
    const newDocument = pick(document, ['_metadata', 'attachments'])
    if (document._attachments)
      Object.defineProperty(newDocument, '_attachments', { value: document._attachments, enumerable: false })
    return newDocument
  }

  addSelfLink(request, urn = null) {
    urn = urn || this.toSpec(request).toUrn()
    request.linkResource('self', urn)
  }

  addBasicToolLinks(request, spec) {
    request.linkResource('self', this.getUrnFor(request, spec))
    // create a new URN for the tool siblings. This should not have a version but should have the tool name
    const newSpec = new EntitySpec(spec.type, spec.provider, spec.namespace, spec.name, spec.revision, spec.tool)
    newSpec.tool = newSpec.tool || this.toolSpec.tool
    delete newSpec.toolVersion
    request.linkSiblings(newSpec.toUrn())
  }

  getUrnFor(request, spec = null) {
    spec = spec || this.toSpec(request)
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

module.exports = AbstractProcessor
