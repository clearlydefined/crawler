// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractProcessor = require('./abstractProcessor')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')

class ScanCodeProcessor extends AbstractProcessor {
  constructor(options) {
    super(options)
    // Kick off version detection but don't wait. We'll wait before processing anything
    this._versionPromise = this._detectVersion()
  }

  get schemaVersion() {
    return this._toolVersion
  }

  get toolSpec() {
    return { tool: 'scancode', toolVersion: this.schemaVersion }
  }

  canHandle(request) {
    return request.type === 'scancode'
  }

  async handle(request) {
    if (!(await this._versionPromise)) return request.markSkip('ScanCode not found')
    super.handle(request)
    const file = this.createTempFile(request)
    await this._runScancode(request, file)
    const location = request.document.location
    const releaseDate = request.document.releaseDate
    request.document = this.clone(request.document)
    const metadata = request.document._metadata
    metadata.contentLocation = file.name
    metadata.contentType = 'application/json'
    metadata.releaseDate = releaseDate
    await this._attachInterestingFiles(request.document, file.name, location)
    return request
  }

  async _runScancode(request, file) {
    this.logger.info(
      `Analyzing ${request.toString()} using ScanCode. input: ${request.document.location} output: ${file.name}`
    )
    const { options, timeout, processes, format } = this.options
    const parameters = [...options, '--timeout', timeout.toString(), '-n', processes.toString(), format].join(' ')
    try {
      await promisify(exec)(
        `cd ${this.options.installDir} && .${path.sep}scancode ${parameters} ${file.name} ${request.document.location}`,
        { maxBuffer: 5000 * 1024 }
      )
    } catch (error) {
      if (this._isRealError(error) || this._hasRealErrors(file.name)) {
        request.markDead('Error', error ? error.message : 'ScanCode run failed')
        throw error
      }
    }
  }
  _attachInterestingFiles(document, outputFile, root) {
    // TODO for each file, if we think its interesting, attach it. The interesting files of interest are things like
    // package metadata or files found to BE full license texts. Need ScanCode to have a better way of detecting
    // the latter.
    const output = JSON.parse(fs.readFileSync(outputFile))
    // Pick files that are potentially whole licenses. We can be reasonably agressive here
    // and the summarizers etc will further refine what makes it into the final definitions
    // TODO add other criteria here.
    // TODO commenting out for now as `is_license_text` casts too broad a net (even iwth the scoring filter.
    // Need a better predicate. In the end it's ok in general as we use Licensee as well. Problem is that only
    // finds files with a single license. Was hoping that ScanCode could file a gap there.
    // const files = output.files
    //   .filter(file => file.licenses.some(license => license.score >= 50 && license.matched_rule.is_license_text))
    //   .map(file => file.path)

    // Pick files that represent whole packages. We can be reasonably agressive here
    // and the summarizers etc will further refine what makes it into the final definitions
    // TODO confirm with @pobmredanne that we need to reverse engineer this and that this is the correct way.
    // Seems to work for NPM but need more examples.
    const packages = output.files.reduce((result, file) => {
      file.packages.forEach(entry => {
        if (file.type === 'directory' && entry.manifest_path)
          result.push(`${file.path ? file.path + '/' : ''}${entry.manifest_path}`)
      })
      return result
    }, [])
    return this.attachFiles(document, packages, root)
  }

  // Workaround until https://github.com/nexB/scancode-toolkit/issues/983 is resolved
  _isRealError(error) {
    return error && error.message && !error.message.includes('Some files failed to scan properly')
  }

  // Scan the results file for any errors that are not just timeouts or other known errors
  _hasRealErrors(resultFile) {
    const results = JSON.parse(fs.readFileSync(resultFile))
    return results.files.some(file =>
      file.scan_errors.some(error => {
        return !(
          error.includes('ERROR: Processing interrupted: timeout after') ||
          error.includes('ValueError:') ||
          error.includes('package.json')
        )
      })
    )
  }

  _getUrn(spec) {
    const newSpec = Object.assign(Object.create(spec), spec, { tool: 'scancode', toolVersion: this.toolVersion })
    return newSpec.toUrn()
  }

  _detectVersion() {
    if (this._versionPromise) return this._versionPromise
    this._versionPromise = new Promise(resolve => {
      exec(`cd ${this.options.installDir} && .${path.sep}scancode --version`, 1024, (error, stdout) => {
        if (error) this.logger.log(`Could not detect version of ScanCode: ${error.message}`)
        this._toolVersion = error ? null : stdout.replace('ScanCode version ', '').trim()
        resolve(this._toolVersion)
      })
    })
    return this._versionPromise
  }
}

module.exports = options => new ScanCodeProcessor(options)
