// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractProcessor = require('./abstractProcessor')
const { exec } = require('child_process')
const bufferReplace = require('buffer-replace')
const path = require('path')

class FossologyProcessor extends AbstractProcessor {
  constructor(options) {
    super(options)
    // Kick off version detection but don't wait. We'll wait before processing anything
    this._versionPromise = this._detectVersion()
  }

  get schemaVersion() {
    return this._toolVersion
  }

  get toolSpec() {
    return { tool: 'fossology', toolVersion: this.schemaVersion }
  }

  canHandle(request) {
    return request.type === 'fossology'
  }

  async handle(request) {
    if (!(await this._versionPromise)) return request.markSkip('FOSSology tools not properly configured')
    super.handle(request)
    this.logger.info(`Analyzing ${request.toString()} using FOSSology. input: ${request.document.location}`)
    await this._createDocument(request)
    return request
  }

  async _createDocument(request) {
    const nomosOutput = await this._runNomos(request)
    const files = await this.filterFiles(request.document.location)
    const copyrightOutput = await this._runCopyright(request, files, request.document.location)
    const monkOutput = await this._runMonk(request, files, request.document.location)
    request.document = this.clone(request.document)
    if (nomosOutput) request.document.nomos = nomosOutput
    if (copyrightOutput) request.document.copyright = copyrightOutput
    if (monkOutput) request.document.monk = monkOutput
  }

  async _runNomos(request) {
    return new Promise((resolve, reject) => {
      const parameters = [].join(' ')
      exec(
        `cd ${this.options.installDir}/nomos/agent && ./nomossa -ld ${request.document.location} ${parameters}`,
        { maxBuffer: 5000 * 1024 },
        (error, stdout) => {
          if (error) {
            request.markDead('Error', error ? error.message : 'FOSSology run failed')
            return reject(error)
          }
          const output = {
            contentType: 'text/plain',
            content: bufferReplace(new Buffer(stdout), request.document.location + '/', '').toString()
          }
          const nomosOutput = { version: this._nomosVersion, parameters, output }
          resolve(nomosOutput)
        }
      )
    })
  }

  async _visitFiles(files, runner) {
    const results = []
    for (const file of files) {
      try {
        const output = await runner(file)
        if (output) results.push({ path: file, output: JSON.parse(output) })
      } catch (error) {
        this.logger.error(error)
      }
    }
    return { contentType: 'application/json', content: results }
  }

  async _runCopyright(request, files, root) {
    const parameters = ['-J']
    const output = await this._visitFiles(files, file =>
      this._runCopyrightOnFile(request, path.join(root, file), parameters)
    )
    return { version: this._copyrightVersion, parameters, output }
  }

  _runCopyrightOnFile(request, file, parameters = []) {
    return new Promise((resolve, reject) => {
      exec(
        `cd ${this.options.installDir}/copyright/agent && ./copyright --files ${file} ${parameters.join(' ')}`,
        (error, stdout) => {
          if (error) {
            request.markDead('Error', error ? error.message : 'FOSSology copyright run failed')
            return reject(error)
          }
          resolve(stdout)
        }
      )
    })
  }

  async _runMonk(request, files, root) {
    // TODO can't actually run Monk until the license database is factored out
    return { request, files, root }
    // const parameters = ['-J']
    // const output = await this._visitFiles(files, path => this._runMonkOnFile(request, path, parameters))
    // TODO figure out the format of the Monk output and correctly aggregate and adjust paths etc.
    // return { version: this._monkVersion, parameters, output }
  }

  _runMonkOnFile(request, file, parameters) {
    // TODO figure out where to get a license database file. May have to be created at build time
    const licenseFile = ''
    return new Promise((resolve, reject) => {
      exec(
        `cd ${this.options.installDir}/monk/agent && ./monk -k ${licenseFile} ${parameters.join('')} ${file}`,
        (error, stdout) => {
          if (error) {
            request.markDead('Error', error ? error.message : 'FOSSology monk run failed')
            return reject(error)
          }
          resolve(stdout)
        }
      )
    })
  }

  async _detectVersion() {
    if (this._versionPromise) return this._versionPromise
    try {
      // base is used to account for any high level changes in the way the FOSSology tools are run or configured
      const base = '0.0.0'
      this._nomosVersion = await this._detectNomosVersion()
      this._copyrightVersion = await this._detectCopyrightVersion()
      this._monkVersion = await this._detectMonkVersion()
      // Aggregate all the discovered versions including that of the superclass chain (pre-computed `_toolVersion`) and
      // a base version for the FOSSology support itself
      this._toolVersion = this.aggregateVersions(
        [base, this._toolVersion, this._nomosVersion, this._copyrightVersion, this._monkVersion],
        'FOSSology tool version misformatted'
      )
      return this._toolVersion
    } catch (error) {
      this.logger.log(`Could not find FOSSology tool version: ${error.message}`)
      return null
    }
  }

  _detectNomosVersion() {
    return new Promise((resolve, reject) => {
      exec(`cd ${this.options.installDir}/nomos/agent && ./nomossa -V`, (error, stdout) => {
        if (error) return reject(error)
        const rawVersion = stdout.replace('nomos build version:', '').trim()
        resolve(rawVersion.replace(/-.*/, '').trim())
      })
    })
  }

  _detectMonkVersion() {
    // TODO remove this and uncomment exec once we are sure of how to get Monk to build with a version number
    // currently it always reports "no version available"
    return '0.0.0'
    // return new Promise((resolve, reject) => {
    //   exec(`cd ${this.options.installDir}/monk/agent && ./monk -V`, (error, stdout) => {
    //     if (error) return reject(error)
    //     const rawVersion = stdout.replace('monk version', '').trim()
    //     resolve(rawVersion.replace(/-.*/, '').trim())
    //   })
    // })
  }

  // TODO see how copyright outputs its version and format accordingly. The code appears to not have
  // a means of getting a version. So, for now, use 0.0.0 to simulate using the same version as
  // nomos. That will be taken as the overall version of the FOSSology support as they are
  // built from the same tree at the same time.
  _detectCopyrightVersion() {
    return '0.0.0'
  }
}

module.exports = options => new FossologyProcessor(options)
