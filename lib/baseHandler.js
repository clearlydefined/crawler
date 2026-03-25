// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const tmp = require('tmp')
const semver = require('semver')
const EntitySpec = require('../lib/entitySpec')
const fs = require('fs')
const crypto = require('crypto')
const config = require('painless-config')

tmp.setGracefulCleanup()

class BaseHandler {
  /** @param {{ logger: { log(level: string, message: string, meta?: Record<string, unknown>): void }, [key: string]: unknown }} options */
  constructor(options) {
    this.options = options
    this.logger = options.logger
  }

  /**
   * Handle the given request in a way appropriate for the given request
   * @param {any} _request
   */
  handle(_request) {}

  get tmpOptions() {
    const tmpBase = config.get('TEMPDIR') || (process.platform === 'win32' ? 'c:/temp/' : '/tmp/')
    return {
      unsafeCleanup: true,
      tmpdir: tmpBase,
      prefix: 'cd-'
    }
  }

  /** @param {string} file */
  async computeHashes(file) {
    if (!file) return null
    const sha1 = await this._hashFile(file, 'sha1')
    const sha256 = await this._hashFile(file, 'sha256')
    return { sha1, sha256 }
  }

  /**
   * @param {string} path
   * @param {string} algorithm
   */
  _hashFile(path, algorithm) {
    const file = fs.createReadStream(path)
    const hash = crypto.createHash(algorithm)
    hash.setEncoding('hex')
    return new Promise((resolve, reject) => {
      file.on('end', () => {
        hash.end()
        resolve(hash.read())
      })
      file.on('error', error => reject(error))
      file.pipe(hash)
    })
  }

  /** @param {{ trackCleanup(cb: () => void): void }} request */
  createTempFile(request) {
    const result = tmp.fileSync(this.tmpOptions)
    request.trackCleanup(result.removeCallback)
    return result
  }

  /** @param {{ trackCleanup(cb: () => void): void }} request */
  createTempDir(request) {
    const result = tmp.dirSync(this.tmpOptions)
    request.trackCleanup(result.removeCallback)
    return result
  }

  /** @param {{ casedSpec?: any, url: string }} request */
  toSpec(request) {
    return request.casedSpec || EntitySpec.fromUrl(request.url)
  }

  /** @param {string | string[]} versions */
  getLatestVersion(versions) {
    if (!Array.isArray(versions)) return versions
    if (versions.length === 0) return null
    if (versions.length === 1) return versions[0]
    return versions
      .filter(v => !this.isPreReleaseVersion(v))
      .reduce((max, current) => (semver.gt(current, max) ? current : max), versions[0])
  }

  /** @param {string} version */
  isPreReleaseVersion(version) {
    return semver.prerelease(version) !== null
  }

  /** @param {{ markSkip(outcome: string): any }} request */
  markSkip(request) {
    return request.markSkip('Missing  ')
  }
}

module.exports = BaseHandler
