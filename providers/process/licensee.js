// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const { exec } = require('child_process')
const { omit } = require('lodash')

let _versionPromise
let _toolVersion

class LicenseeProcessor extends BaseHandler {
  constructor(options) {
    super(options)
    // Kick off version detection but don't wait. We'll wait before processing anything
    this._detectVersion()
  }

  get schemaVersion() {
    return _toolVersion
  }

  get toolSpec() {
    return { tool: 'licensee', toolVersion: this.schemaVersion }
  }

  canHandle(request) {
    return request.type === 'licensee'
  }

  async handle(request) {
    if (!(await this._detectVersion())) return request.markSkip('Licensee not found')
    const { spec } = super._process(request)
    this.addBasicToolLinks(request, spec)
    await this._createDocument(request)
    return request
  }

  async _createDocument(request) {
    const record = await this._run(request)
    const location = request.document.location
    const document = { _metadata: request.document._metadata }
    if (!record) return
    document.licensee = record
    const toAttach = record.output.content.matched_files
      .filter(file => file.matcher.name === 'exact' && file.matcher.confidence >= 80)
      .map(file => file.filename)
    BaseHandler.attachFiles(document, toAttach, location)
    request.document = document
  }

  async _run(request) {
    return new Promise((resolve, reject) => {
      const parameters = ['--json', '--no-readme'].join(' ')
      exec(
        `licensee detect ${parameters} ${request.document.location}`,
        { maxBuffer: 5000 * 1024 },
        (error, stdout) => {
          if (error) {
            request.markDead('Error', error ? error.message : 'Licensee run failed')
            return reject(error)
          }
          const results = JSON.parse(stdout)
          const record = {
            version: this.schemaVersion,
            parameters: parameters,
            output: {
              contentType: 'application/json',
              content: results
            }
          }
          resolve(record)
        }
      )
    })
  }

  _getUrn(spec) {
    const newSpec = Object.assign(Object.create(spec), spec, { tool: 'licensee', toolVersion: this.toolVersion })
    return newSpec.toUrn()
  }

  _detectVersion() {
    if (_versionPromise !== undefined) return _versionPromise
    _versionPromise = new Promise(resolve => {
      exec('licensee version', 1024, (error, stdout) => {
        if (error) this.logger.log(`Could not detect version of Licensee: ${error.message}`)
        _toolVersion = error ? null : stdout
        resolve(_toolVersion)
      })
    })
    return _versionPromise
  }
}

module.exports = options => new LicenseeProcessor(options)
