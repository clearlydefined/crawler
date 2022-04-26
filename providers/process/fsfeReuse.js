// Copyright (c) SAP SE and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractProcessor = require('./abstractProcessor')
const { promisify } = require('util')
const execFile = promisify(require('child_process').execFile)
const { merge } = require('lodash')
const { readdirSync } = require('fs')

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
    const location = request.document.location
    request.document = merge(this.clone(request.document), { reuse: record })
    this.attachFiles(request.document, record.licenses.map(file => file.filePath), location)
  }

  async _run(request) {
    const root = request.document.location
    const parameters = [('spdx')]
    try {
      // Default buffer of 1024x1024 (see https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback) doesn't seem to be enough sometimes
      const { stdout } = await execFile('reuse', parameters, { cwd: root, maxBuffer: (2048 * 1024) })
      if (!stdout) return
      const results = { metadata: {}, files: [], licenses: this._getLicenses(request) }
      // REUSE SPDX results are grouped in sections that are separated with two newlines
      // The first result group contains generic result metadata, the following ones represent a file each. We process both variants in a single loop...
      stdout.trim().split(/\n\n/).forEach((spdxResult, entryIndex) => this._handleResultSection(spdxResult, entryIndex, results))
      return results
    } catch (error) {
      request.markDead('Error', error ? error.message : 'REUSE run failed')
    }
  }

  _handleResultSection(spdxResult, entryIndex, results) {
    const spdxResultFile = {}
    const spdxRawValues = spdxResult.split(/\n/)
    // Each line represents a single result attribute
    spdxRawValues.forEach(spdxRawValue => this._handleResultAttribute(spdxRawValue, entryIndex, results, spdxResultFile))
    // Generic metadata was already added to results.metadata
    // In case we have file metadata, all attributes are read now and information can be added to the file results
    if (entryIndex > 0) {
      results.files.push(spdxResultFile)
    }
  }

  _handleResultAttribute(spdxRawValue, entryIndex, results, spdxResultFile) {
    const spdxMatchResult = spdxRawValue.match(/((?<first_key>\w+):\s)((?<second_key>\w+):\s)?(?<spdx_value>.+)/)
    if (spdxMatchResult !== null) {
      const spdxResultValue = { key: spdxMatchResult.groups.first_key, secondaryKey: spdxMatchResult.groups.second_key, spdxValue: spdxMatchResult.groups.spdx_value.replace(/(<\/?([^>]+)>)/g, '') }
      // First result section contains generic metadata, any other section attributes for a particular file
      if (entryIndex === 0) {
        this._addMetadataAttribute(spdxResultValue, results)
      } else {
        this._addResultFileAttribute(spdxResultValue, spdxResultFile)
      }
    }
  }

  _addMetadataAttribute(spdxResultValue, results) {
    // Relationship attributes are ignored on purpose as they won't be used later and would only consume memory...
    if (spdxResultValue.key !== 'Relationship') {
      results.metadata[spdxResultValue.key + (spdxResultValue.secondaryKey ? spdxResultValue.secondaryKey : '')] = spdxResultValue.spdxValue
    }
  }

  _addResultFileAttribute(spdxResultValue, spdxResultFile) {
    let attributeValue = spdxResultValue.spdxValue
    // ClearlyDefined gets confused by file paths starting with './'. As they are normal relative paths, we remove this prefix here...
    if (spdxResultValue.key === 'FileName' && attributeValue.startsWith('./')) {
      attributeValue = attributeValue.substring(2)
    }
    // If copyright text is extracted from the file header, REUSE might add 'SPDX-FileCopyrightText' to the value
    // We don't need this additional information and remove it here, so that all copyright texts are consistent...
    if (spdxResultValue.key === 'FileCopyrightText' && attributeValue.startsWith('SPDX-FileCopyrightText: ')) {
      attributeValue = attributeValue.substring(24)
    }
    spdxResultFile[spdxResultValue.key + (spdxResultValue.secondaryKey ? spdxResultValue.secondaryKey : '')] = attributeValue
  }

  _getLicenses(request) {
    const licenses = []
    const licensesDir = 'LICENSES'
    try {
      const licenseFiles = readdirSync(request.document.location + '/' + licensesDir)
      licenseFiles.forEach(file => {
        licenses.push({
          filePath: licensesDir + '/' + file, spdxId: file.substring(0, file.indexOf('.txt'))
        })
      })
    } catch (error) {
      this.logger.log(`Error reading LICENSES directory: ${error.message}`)
    }
    return licenses
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
