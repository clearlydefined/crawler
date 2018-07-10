// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const du = require('du')

const writeFile = promisify(fs.writeFile)
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

    // get file list need to process 
    const file_list = await this._getFilelist(document)
    // get nomos output
    const nomosStdout = await this._getNomos(request)
    // get copyright output
    const copyrightStdout = await this._getCopyright(request, file_list)

    console.log(nomosStdout)
    console.log(copyrightStdout)
    // TODO update to indicate the correct content type for the FOSSology output
    request.document._metadata.contentLocation = file.name
    request.document._metadata.contentType = 'text/plain'
    request.document._metadata.releaseDate = request.document.releaseDate
  }

  async _getNomos(request) {
    return new Promise((resolve, reject) => {
      // TODO add correct parameters and command line here
      const parameters = ['-ld', request.document.location].join(' ')
      exec(`cd ${this.options.installDir} && ./nomos/agent/nomos ${parameters}`, (error, stdout, stderr) => {
        if (error) {
          request.markDead('Error', error ? error.message : 'FOSSology run failed')
          return reject(error)
        }
        resolve(stdout)
      })
    })
  }

  async _getCopyright(request, files) {
    return new Promise((resolve, reject) => {
      // TODO add correct parameters and command line here
      const parameters = ['--files', files].join(' ')
      exec(`cd ${this.options.installDir} && ./copyright/agent/copyright ${parameters}`, (error, stdout, stderr) => {
        if (error) {
          request.markDead('Error', error ? error.message : 'FOSSology CopyRight tool run failed')
          return reject(error)
        }
        resolve(stdout)
      })
    })
  }

  async _getFilelist(document) {
    return new Promise((resolve, reject) => {
      exec(`find ${document.location} -type f -print |tr "\\n" " "`, (error, stdout, stderr) => {
        if (error) {
          return reject(error)
        }
        //this.logger.info(stdout)
        resolve(stdout)
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
      exec(`cd ${this.options.installDir} && .${path.sep}nomos${path.sep}agent${path.sep}nomos -V`, (error, stdout, stderr) => {
        if (error) return reject(error)
        _toolVersion = stdout.replace('nomos\ build\ version:', '').trim()
        _toolVersion = _toolVersion.replace(/r\(.*\)./, '').trim()
        resolve(_toolVersion)
      })
    })
  }
}

module.exports = options => new FossologyProcessor(options)
