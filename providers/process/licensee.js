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
    // TODO little questionable here. Kick off an async operation on load with the expecation that
    // by the time someone actually uses this instance, the call will have completed.
    // Need to detect the tool version before anyone tries to run this processor.
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
    const { spec } = super._process(request)
    if (!(await this._detectVersion())) return request.markSkip('Licensee not found')
    this.addBasicToolLinks(request, spec)
    await this._createDocument(request)
    return request
  }

  async _createDocument(request) {
    const output = await this._run(request)
    const location = request.document.location
    const document = { _metadata: request.document._metadata }
    if (!output) return
    document.licensee = output
    // Strip off the redundant (and potentially large) props and skip anything with low confidence or not exact match
    const attachments = output.output.content
      .filter(file => file.matcher.name === 'exact' && file.matcher.confidence >= 80)
      .map(file => omit(file, 'content', 'content_normalized'))
    BaseHandler.attachFiles(document, attachments.map(file => file.filename), location)
    request.document = document
  }

  async _run(request) {
    return new Promise((resolve, reject) => {
      const parameters = ['detect', '--json', '--no-readme', '--no-packages'].join(' ')
      exec(`licensee ${parameters} ${request.document.location}`, { maxBuffer: 5000 * 1024 }, (error, stdout) => {
        if (error) {
          request.markDead('Error', error ? error.message : 'Licensee run failed')
          return reject(error)
        }
        const results = JSON.parse(stdout)
        const output = {
          version: this.schemaVersion,
          parameters: parameters,
          output: {
            contentType: 'application/json',
            content: results.matched_files
          }
        }
        resolve(output)
      })
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
