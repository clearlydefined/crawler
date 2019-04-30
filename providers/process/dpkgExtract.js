// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const fs = require('fs')
const path = require('path')
const { merge } = require('lodash')
const SourceSpec = require('../../lib/sourceSpec')

class DpkgExtract extends AbstractClearlyDefinedProcessor {
  get toolVersion() {
    return '1.0.0'
  }

  get toolName() {
    return 'dpkg'
  }

  canHandle(request) {
    return request.type === 'dpkg'
  }

  async handle(request) {
    if (this.isProcessing(request)) {
      const location = request.document.location
      await super.handle(request, location, 'package')
      const copyrightLocation = this._getCopyrightLocation(location)
      const controlLocation = this._getControlLocation(location)
      const copyright = copyrightLocation ? fs.readFileSync(path.join(location, copyrightLocation)).toString() : null
      const control = controlLocation ? fs.readFileSync(path.join(location, controlLocation)).toString() : null
      await this._createDocument(request, copyright, control)
    }
    this.linkAndQueueTool(request, 'licensee')
    this.linkAndQueueTool(request, 'fossology')
    this.linkAndQueueTool(request, 'scancode')
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.fromObject(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
    return request
  }

  async _createDocument(request, copyright, control) {
    request.document = merge(this.clone(request.document), { copyright, control })
    // todo: parse control file for source links
    // const sourceInfo = await this._discoverSource(control)
    // if (sourceInfo) request.document.sourceInfo = sourceInfo
  }

  _getCopyrightLocation(dir) {
    if (fs.existsSync(path.join(dir, 'copyright'))) return 'copyright'
    if (fs.existsSync(path.join(dir, 'debian/copyright'))) return 'debian/copyright'
  }

  _getControlLocation(dir) {
    if (fs.existsSync(path.join(dir, 'control'))) return 'control'
    if (fs.existsSync(path.join(dir, 'debian/control'))) return 'debian/control'
  }
}

module.exports = options => new DpkgExtract(options)
