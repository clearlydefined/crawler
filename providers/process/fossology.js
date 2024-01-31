// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractProcessor = require('./abstractProcessor')
const { promisify } = require('util')
const child_process = require('child_process')
const execFile = promisify(child_process.execFile)
const spawn = child_process.spawn
const path = require('path')

class FossologyProcessor extends AbstractProcessor {
  constructor(options) {
    super(options)
    // Kick off version detection but don't wait. We'll wait before processing anything
    this._versionPromise = this._detectVersion()
  }

  get toolVersion() {
    return this._toolVersion
  }

  get toolName() {
    return 'fossology'
  }

  canHandle(request) {
    return request.type === 'fossology'
  }

  async handle(request) {
    if (this.options.disabled) return request.markSkip('Disabled  ')
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
    if (!nomosOutput && !copyrightOutput && !monkOutput)
      request.markDead('Error', 'FOSSology run failed with no results')
    if (nomosOutput) request.document.nomos = nomosOutput
    if (copyrightOutput) request.document.copyright = copyrightOutput
    if (monkOutput) request.document.monk = monkOutput
  }

  async _runNomos(request) {
    const parameters = []
    const result = await new Promise(resolve => {
      let data = ''
      const nomos = spawn(`${this.options.installDir}/nomos/agent/nomossa`, [
        '-ld',
        request.document.location,
        ...parameters
      ])
      nomos.stdout.on('data', chunk => {
        if (data) data += chunk
        else data = chunk
      })
      nomos
        .on('error', error => {
          this.logger.error(error)
          resolve(null)
        })
        .on('close', () => {
          resolve(data.toString().replace(new RegExp(`${request.document.location}/`, 'g'), ''))
        })
    })
    const output = {
      contentType: 'text/plain',
      content: result.replace(new RegExp(`${request.document.location}/`, 'g'), '')
    }
    return { version: this._nomosVersion, parameters: parameters.join(' '), output }
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

  async _runCopyrightOnFile(request, file, parameters = []) {
    try {
      const { stdout } = await execFile(
        `${this.options.installDir}/copyright/agent/copyright`,
        ['--files', file, ...parameters],
        { cwd: `${this.options.installDir}/copyright/agent` }
      )
      return stdout
    } catch (error) {
      if (error) {
        this.logger.error(error)
        return null
      }
    }
  }

  async _runMonk(request, files, root) {
    const parameters = ['-k', 'monk_knowledgebase'] // 'monk_knowledgebase' created at build time
    const chunkSize = 500
    const output = {
      contentType: 'text/plain',
      content: ''
    }
    for (let i = 0; i < files.length; i += chunkSize) {
      const fileArguments = files.slice(i, i + chunkSize).map(file => path.join(root, file))
      const result = await new Promise(resolve => {
        let data = ''
        const monk = spawn(`${this.options.installDir}/monk/agent/monk`, [...parameters, ...fileArguments], {
          cwd: `${this.options.installDir}/monk/agent`
        })
        monk.stdout.on('data', chunk => {
          if (data) data += chunk
          else data = chunk
        })
        monk
          .on('error', error => {
            this.logger.error(error)
            resolve(null)
          })
          .on('close', () => {
            resolve(data.toString())
          })
      })
      output.content += result.replace(new RegExp(`${request.document.location}/`, 'g'), '')
    }

    if (output.content) return { version: this._monkVersion, parameters, output }
    return null
  }

  async _detectVersion() {
    if (this._versionPromise) return this._versionPromise
    try {
      this._nomosVersion = await this._detectNomosVersion()
      this._copyrightVersion = await this._detectCopyrightVersion()
      this._monkVersion = await this._detectMonkVersion()
      // Treat the NOMOS version as the global FOSSology tool version
      this._toolVersion = this._nomosVersion
      this._schemaVersion = this.aggregateVersions([this._schemaVersion, this.toolVersion, this.configVersion])
      return this._schemaVersion
    } catch (error) {
      this.logger.log(`Could not find FOSSology tool version: ${error.message}`)
      return null
    }
  }

  async _detectNomosVersion() {
    const { stdout } = await execFile(`${this.options.installDir}/nomos/agent/nomossa`, ['-V'])
    const rawVersion = stdout.replace('nomos build version:', '').trim()
    return rawVersion.replace(/[-\s].*/, '').trim()
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
