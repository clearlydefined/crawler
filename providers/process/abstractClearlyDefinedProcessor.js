// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const { set } = require('lodash')
const { promisify } = require('util')
const getFiles = promisify(require('node-dir').files)
const throat = require('throat')
const path = require('path')
const glob = require('fast-glob')
const fs = require('fs')

class AbstractClearlyDefinedProcessor extends BaseHandler {
  async handle(request) {
    super.handle(request)
    await this._addSummaryInfo(request)
    await this._addFiles(request)
  }

  async addInterestingFiles(document, location, folder = '') {
    if (!location && location !== '') return null
    const files = await glob(
      this._buildGlob(['license', 'notice', 'notices', 'license-mit', 'license-apache', 'unlicense']),
      {
        cwd: path.join(location, folder),
        nocase: true,
        onlyFiles: true
      }
    )
    if (files.length === 0) return null
    Object.defineProperty(document, '_attachments', { value: [], enumerable: false })
    const interestingFiles = await Promise.all(
      files.map(async file => {
        const fullPath = path.join(location, folder, file)
        const relativePath = path.join(folder, file)
        const attachment = fs.readFileSync(fullPath, 'utf8')
        const token = BaseHandler.computeToken(attachment)
        // const license = await this._detectLicenses(fullPath)
        // TODO do proper intergation here
        const license = 'NOASSERTION'
        document._attachments.push({ path: relativePath, token, attachment, license })
        return { path: relativePath, token, license }
      })
    )
    document.interestingFiles = interestingFiles
  }

  _buildGlob(roots) {
    const parts = []
    roots.forEach(root => {
      parts.push(root)
      parts.push(`${root}.{md,txt,html}`)
    })
    return `+(${parts.join('|')})`
  }

  async _addSummaryInfo(request) {
    const stats = await this._computeSize(request.document.location)
    request.addMeta(stats)
    request.document.summaryInfo = { ...stats }
    const hashes = request.document.hashes
    if (hashes) request.document.summaryInfo.hashes = hashes
  }

  async _addFiles(request) {
    const fileList = await getFiles(request.document.location)
    const files = fileList.map(
      throat(10, async file => {
        const hashes = await this._computeHashes(file)
        return { path: file, hashes }
      })
    )
    set(request, 'document.files', files)
  }

  async _computeSize(location) {
    let count = 0
    const bytes = await promisify(du)(location, {
      filter: file => {
        if (path.basename(file) === '.git') return false
        count++
        return true
      }
    })
    return { k: Math.round(bytes / 1024), count }
  }
}

module.exports = AbstractClearlyDefinedProcessor
