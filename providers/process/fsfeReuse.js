// Copyright (c) SAP SE and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractProcessor = require('./abstractProcessor')
const { promisify } = require('util')
const execFile = promisify(require('child_process').execFile)
const { merge } = require('lodash')

class FsfeReuseProcessor extends AbstractProcessor {
  constructor(options) {
    super(options)
    // Kick off version detection but don't wait. We'll wait before processing anything...
    this._versionPromise = this._detectVersion()
  }

  get toolVersion() {
    return this._toolVersion
  }

  get toolName() {
    return 'reuse'
  }

  canHandle(request) {
    return request.type === 'reuse'
  }

  async handle(request) {
    if (this.options.disabled) return request.markSkip('Disabled  ')
    if (!(await this._versionPromise)) return request.markSkip('REUSE tool not properly configured')
    super.handle(request)
    await this._createDocument(request)
    return request
  }

  async _createDocument(request) {
    const record = await this._run(request)
    if (!record) return
    request.document = merge(this.clone(request.document), { reuse: record })
  }

  async _run(request) {
    const root = request.document.location
    const parameters = [('spdx')]
    try {
      const { stdout } = await execFile('reuse', parameters, { cwd: root })
      if (!stdout) return
      const results = { metadata: {}, files: [] }
      stdout.trim().split(/\n\n/).forEach((spdxResult, entryIndex) => {
        const spdxResultFile = {}
        const spdxRawValues = spdxResult.split(/\n/)
        spdxRawValues.forEach(spdxRawValue => {
          const spdxMatchResult = spdxRawValue.match(/((?<first_key>\w+):\s)((?<second_key>\w+):\s)?(?<spdx_value>.+)/)
          if (spdxMatchResult !== null) {
            const spdxResultValue = { key: spdxMatchResult.groups.first_key, secondaryKey: spdxMatchResult.groups.second_key, spdxValue: spdxMatchResult.groups.spdx_value.replace(/(<\/?([^>]+)>)/g, '') }
            if (entryIndex === 0) {
              if (spdxResultValue.key !== 'Relationship') {
                results.metadata[spdxResultValue.key + (spdxResultValue.secondaryKey ? spdxResultValue.secondaryKey : '')] = spdxResultValue.spdxValue
              }
            } else {
              let attributeValue = spdxResultValue.spdxValue
              if (spdxResultValue.key === 'FileName' && attributeValue.startsWith('./')) {
                attributeValue = attributeValue.substring(2)
              }
              if (spdxResultValue.key === 'FileCopyrightText' && attributeValue.startsWith('SPDX-FileCopyrightText: ')) {
                attributeValue = attributeValue.substring(24)
              }
              spdxResultFile[spdxResultValue.key + (spdxResultValue.secondaryKey ? spdxResultValue.secondaryKey : '')] = attributeValue
            }
          }
        })
        if (entryIndex > 0) {
          results.files.push(spdxResultFile)
        }
      })
      return results
    } catch (error) {
      request.markDead('Error', error ? error.message : 'REUSE run failed')
    }
  }

  _detectVersion() {
    if (this._versionPromise !== undefined) return this._versionPromise
    this._versionPromise = execFile('reuse', ['--version'])
      .then(result => {
        const reuseRegex = /reuse\s+(\d+\.\d+(\.\d+)?)/i
        this._toolVersion = result.stdout.trim().match(reuseRegex)[1]
        this._schemaVersion = this.aggregateVersions(
          [this._schemaVersion, this.toolVersion, this.configVersion],
          'Invalid REUSE version'
        )
        return this._schemaVersion
      })
      .catch(error => {
        if (error) this.logger.log(`Could not detect version of REUSE: ${error.message}`)
      })
    return this._versionPromise
  }
}

module.exports = options => new FsfeReuseProcessor(options)
