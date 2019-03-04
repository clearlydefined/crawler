// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractProcessor = require('./abstractProcessor')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

class FossaProcessor extends AbstractProcessor {
  constructor(options) {
    super(options)
    // Kick off version detection but don't wait. We'll wait before processing anything
    this._versionPromise = this._detectVersion()
  }

  get toolVersion() {
    return this._toolVersion
  }

  get toolName() {
    return 'fossa'
  }

  canHandle(request) {
    return request.type === 'fossa'
  }

  async handle(request) {
    if (!(await this._versionPromise)) return request.markSkip('fossa tool not properly configured')
    super.handle(request)
    this.logger.info(`Analyzing ${request.toString()} using fossa. input: ${request.document.location}`)
    await this._createDocument(request)
    return request
  }

  async _createDocument(request) {
    const file = this.createTempFile(request)
    await this._runFossa(request, file)
    request.document = this.clone(request.document)
    request.document._metadata.contentLocation = file.name
    request.document._metadata.contentType = 'application/json'
  }

  async _detectVersion() {
    if (this._versionPromise) return this._versionPromise
    this._versionPromise = new Promise(resolve => {
      exec(`cd ${this.options.installDir} && ./fossa --version`, (error, stdout) => {
        if (error) {
          this.logger.log(`Could not detect version of fossa: ${error.message}`)
          return resolve(null)
        }
        this._toolVersion = stdout
          .split('fossa-cli version')[1]
          .split('(revision')[0]
          .trim()
        this._schemaVersion = this.aggregateVersions([this._schemaVersion, this.toolVersion, this.configVersion])
        resolve(this._schemaVersion)
      })
    })
    return this._versionPromise
  }

  async _runFossa(request, file) {
    return new Promise((resolve, reject) => {
      const parameters = [].join(' ')
      exec(
        `cd ${request.document.location} && ${this.options.installDir}/fossa -o  ${parameters} > ${file.name}`,
        error => {
          if (error) {
            request.markDead('Error', error ? error.message : 'Fossa run failed')
            return reject(error)
          }
          resolve()
        }
      )
    })
  }
}

module.exports = options => new FossaProcessor(options)
