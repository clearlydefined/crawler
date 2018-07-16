// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const du = require('du')
const dir = require('node-dir')

const getFiles = promisify(dir.files)
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
    this.logger.info(
      `Analyzing ${request.toString()} using FOSSology. input: ${request.document.location}`
    )
    await this._createDocument(request)
    return request
  }

  async _runNomos(request) {
    return new Promise((resolve, reject) => {
      // TODO add correct parameters and command line here
      const parameters = ['-ld', request.document.location].join(' ')
      exec(`cd ${this.options.installDir} && ./nomossa ${parameters}`, (error, stdout, stderr) => {
        if (error) {
          request.markDead('Error', error ? error.message : 'FOSSology run failed')
          return reject(error)
        }
        let buff = new Buffer(stdout)
        const nomosOutput = {
          version: this.schemaVersion,
          parameters: parameters,
          output: {
            contentType: 'text/plain',
            content: buff.toString('base64')
          }
        }
        resolve(JSON.parse(JSON.stringify(nomosOutput)))
      })
    })
  }

  //TODO: will revisit after FOSSology have copyright standalone version
  async _runCopyright(request, files) {
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

  //TODO: will revisit after FOSSology have monk standalone version
  async _runMonk(request, files) {
    return new Promise((resolve, reject) => {
      // TODO add correct parameters and command line here
      const parameters = [files].join(' ')
      exec(`cd ${this.options.installDir} && ./monk/agent/monk ${parameters}`, (error, stdout, stderr) => {
        if (error) {
          request.markDead('Error', error ? error.message : 'FOSSology Monk tool run failed')
          return reject(error)
        }
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
      exec(`cd ${this.options.installDir} && ./nomossa -V`, (error, stdout, stderr) => {
        if (error) return reject(error)
        _toolVersion = stdout.replace('nomos\ build\ version:', '').trim()
        _toolVersion = _toolVersion.replace(/r\(.*\)./, '').trim()
        resolve(_toolVersion)
      })
    })
  }

  async _createDocument(request) {
    //const files = await getFiles(request.document.location)
    const nomosOutput = await this._runNomos(request)
    //const copyrightOutput = await this._runCopyright(request, files)
    //const monkOutput = await this._runMonk(request, files)
    request.document = { _metadata: request.document._metadata}
    if (nomosOutput) request.document.nomos = nomosOutput
  }
}

module.exports = options => new FossologyProcessor(options)
