// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractProcessor = require('./abstractProcessor')
const throat = require('throat')
const path = require('path')
const { pick, merge } = require('lodash')
const du = require('du')
const { trimParents } = require('../../lib/utils')

class AbstractClearlyDefinedProcessor extends AbstractProcessor {
  get toolVersion() {
    return '0.0.0'
  }

  get toolName() {
    return 'clearlydefined'
  }

  async handle(request, location = request.document.location, interestingRoot = '') {
    super.handle(request)
    await this._addSummaryInfo(request, location)
    await this._addFiles(request, location, interestingRoot)
  }

  clone(document) {
    return merge(super.clone(document), pick(document, ['summaryInfo', 'files']))
  }

  async _addSummaryInfo(request, location = request.document.location) {
    const stats = await this._computeSize(location)
    request.addMeta(stats)
    request.document.summaryInfo = { ...stats }
    const hashes = request.document.hashes
    if (hashes) request.document.summaryInfo.hashes = hashes
  }

  async _addFiles(request, location = request.document.location, interestingRoot = '') {
    const fileList = await this.filterFiles(location)
    const files = await Promise.all(
      fileList.map(
        throat(10, async file => {
          if (this._isInterestinglyNamed(file, interestingRoot))
            await this.attachFiles(request.document, [file], location)
          const hashes = await this.computeHashes(path.join(location, file))
          return { path: file, hashes }
        })
      )
    )
    request.document.files = files
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
    const bytes = await du(location, {
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
