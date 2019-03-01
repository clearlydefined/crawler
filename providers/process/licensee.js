// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractProcessor = require('./abstractProcessor')
const { exec } = require('child_process')
const { flatten, merge, uniqBy } = require('lodash')
const { trimAllParents } = require('../../lib/utils')
const path = require('path')
const throat = require('throat')

class LicenseeProcessor extends AbstractProcessor {
  constructor(options) {
    super(options)
    // Kick off version detection but don't wait. We'll wait before processing anything
    this._versionPromise = this._detectVersion()
  }

  get toolVersion() {
    return this._toolVersion
  }

  get toolName() {
    return 'licensee'
  }

  canHandle(request) {
    return request.type === 'licensee'
  }

  async handle(request) {
    if (!(await this._versionPromise)) return request.markSkip('Licensee not properly configured')
    super.handle(request)
    await this._createDocument(request)
    return request
  }

  async _createDocument(request) {
    const record = await this._run(request)
    if (!record) return
    const location = request.document.location
    request.document = merge(this.clone(request.document), { licensee: record })
    const toAttach = record.output.content.matched_files.map(file => file.filename)
    this.attachFiles(request.document, toAttach, location)
  }

  async _run(request) {
    const parameters = ['--json', '--no-readme']
    const root = request.document.location
    const subfolders = await this.getFolders(root, ['.git/'])
    const paths = ['', ...trimAllParents(subfolders, root)]
    try {
      const results = await Promise.all(paths.map(throat(10, path => this._runOnFolder(path, root, parameters))))
      const licenses = uniqBy(flatten(results.map(result => result.licenses)), 'spdx_id')
      const matched_files = flatten(results.map(result => result.matched_files))
      return {
        version: this.toolVersion,
        parameters: parameters,
        output: {
          contentType: 'application/json',
          content: { licenses, matched_files }
        }
      }
    } catch (exception) {
      request.markDead('Error', exception ? exception.message : 'Licensee run failed')
    }
  }

  // Licensee appears to only run on the give folder, not recursively
  async _runOnFolder(folder, root, parameters) {
    return new Promise((resolve, reject) => {
      exec(
        `licensee detect ${parameters.join(' ')} ${path.join(root, folder)}`,
        { maxBuffer: 5000 * 1024 },
        (error, stdout) => {
          // Licensee fails with code = 1 if there are no license files found in the given folder.
          // Not really an error. Just skip it.
          // TODO unclear what code will be returned if there is a real error so be resilient in the
          // handling of stdout
          if (error && error.code !== 1) {
            return reject(error)
          }
          try {
            const result = JSON.parse(stdout)
            result.matched_files.forEach(file => (file.filename = `${folder ? folder + '/' : ''}${file.filename}`))
            resolve(result)
          } catch (exception) {
            return reject(exception)
          }
        }
      )
    })
  }

  _detectVersion() {
    if (this._versionPromise !== undefined) return this._versionPromise
    this._versionPromise = new Promise(resolve => {
      exec('licensee version', 1024, (error, stdout) => {
        if (error) this.logger.log(`Could not detect version of Licensee: ${error.message}`)
        this._toolVersion = stdout.trim()
        this._schemaVersion = error
          ? null
          : this.aggregateVersions(
              [this._schemaVersion, this.toolVersion, this.configVersion],
              'Invalid Licensee version'
            )
        resolve(this._schemaVersion)
      })
    })
    return this._versionPromise
  }
}

module.exports = options => new LicenseeProcessor(options)
