// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const du = require('du')

let _toolVersion

class FossologyProcessor extends BaseHandler {
  constructor(options) {
    super(options)
    // TODO little questionable here. Kick off an async operation on load with the expecation that
    // by the time someone actually uses this instance, the call will have completed.
    // Need to detect the tool version before anyone tries to run this processor.
    this._detectVersion()
  }

  get schemaVersion() {
    return _toolVersion
  }

  get toolSpec() {
    return { tool: 'fossology', toolVersion: this.schemaVersion }
  }

  canHandle(request) {
    return request.type === 'fossology'
  }

  async handle(request) {
    const { document, spec } = super._process(request)
    const size = await this._computeSize(document)
    request.addMeta({ k: size.k, fileCount: size.count })
    this.addBasicToolLinks(request, spec)
    const file = this._createTempFile(request)
    this.logger.info(
      `Analyzing ${request.toString()} using FOSSology. input: ${request.document.location} output: ${file.name}`
    )

    return new Promise((resolve, reject) => {
      // TODO add correct parameters and command line here
      const parameters = [file.name, request.document.location].join(' ')
      exec(`cd ${this.options.installDir} && .${path.sep}fossology ${parameters}`, (error, stdout, stderr) => {
        if (this._isRealError(error) || this._hasRealErrors(file.name)) {
          request.markDead('Error', error ? error.message : 'FOSSology run failed')
          return reject(error)
        }

        // TODO update to indicate the correct content type for the FOSSology output
        document._metadata.contentLocation = file.name
        document._metadata.contentType = 'application/json'
        document._metadata.releaseDate = request.document.releaseDate
        resolve(request)
      })
    })
  }

  async _computeSize(document) {
    let count = 0
    const bytes = await promisify(du)(document.location, {
      filter: file => {
        if (path.basename(file) === '.git') {
          return false
        }
        count++
        return true
      }
    })
    return { k: Math.round(bytes / 1024), count }
  }

  _getUrn(spec) {
    const newSpec = Object.assign(Object.create(spec), spec, { tool: 'fossology', toolVersion: this.toolVersion })
    return newSpec.toUrn()
  }

  _detectVersion() {
    if (_toolVersion) return _toolVersion
    return new Promise((resolve, reject) => {
      exec(`cd ${this.options.installDir} && .${path.sep}fossology --version`, (error, stdout, stderr) => {
        if (error) return reject(error)
        _toolVersion = stdout.replace('FOSSology version ', '').trim()
        resolve(_toolVersion)
      })
    })
  }
}

module.exports = options => new FossologyProcessor(options)
