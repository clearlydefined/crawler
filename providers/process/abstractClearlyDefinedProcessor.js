// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractProcessor = require('./abstractProcessor')
const { promisify } = require('util')
const throat = require('throat')
const path = require('path')
const { pick } = require('lodash')
const du = require('du')
const { trimParents } = require('../../lib/utils')

class AbstractClearlyDefinedProcessor extends AbstractProcessor {
  async handle(request, interestingRoot = '') {
    super.handle(request)
    await this._addSummaryInfo(request)
    await this._addFiles(request, interestingRoot)
  }

  clone(document) {
    return { ...super.clone(document), ...pick(document, ['summaryInfo', 'files']) }
  }

  async _addSummaryInfo(request) {
    const stats = await this._computeSize(request.document.location)
    request.addMeta(stats)
    request.document.summaryInfo = { ...stats }
    const hashes = request.document.hashes
    if (hashes) request.document.summaryInfo.hashes = hashes
  }

  async _addFiles(request, interestingRoot = '') {
    const { document } = request
    const fileList = await this.getInterestingFiles(document.location)
    const files = await Promise.all(
      fileList.map(
        throat(10, async file => {
          if (this._isInterestinglyNamed(file, interestingRoot))
            await this.attachFiles(document, [file], document.location)
          const hashes = await this.computeHashes(path.join(document.location, file))
          return { path: file, hashes }
        })
      )
    )
    document.files = files
  }

  _isInterestinglyNamed(file, root = '') {
    const name = trimParents(file, root).toUpperCase()
    if (!name) return false
    const patterns = [
      'LICENSE',
      'LICENSE-MIT',
      'LICENSE-APACHE',
      'UNLICENSE',
      'COPYING',
      'NOTICE',
      'NOTICES',
      'CONTRIBUTORS',
      'PATENTS'
    ]
    const extensions = ['.MD', '.HTML', '.TXT']
    const extension = path.extname(name)
    if (extension && !extensions.includes(extension)) return false
    const base = path.basename(name, extension || '')
    return patterns.includes(base)
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
