// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const request = require('request')
const fs = require('fs')

class DpkgFetch extends AbstractFetch {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'dpkg'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    if (this.options.disabled) return this.queueSpecific(request, spec)
    const file = this.createTempFile(request)
    await this._getPackage(spec, file.name)
    const dir = this.createTempDir(request)
    await this.decompress(file.name, dir.name)
    request.document = this._createDocument(dir)
    request.contentOrigin = 'origin'
  }

  async _getPackage(spec, destination) {
    const url = `http://deb.debian.org/debian/pool/main/${spec.name.slice(0, 1)}/${spec.name}/${spec.name}_${
      spec.revision
    }.debian.tar.xz`
    return new Promise((resolve, reject) => {
      request
        .get(url, (error, response) => {
          if (error) return reject(error)
          if (response.statusCode !== 200) reject(new Error(`${response.statusCode} ${response.statusMessage}`))
        })
        .pipe(fs.createWriteStream(destination).on('finish', () => resolve(null)))
    })
  }

  _createDocument(dir) {
    return { location: dir.name }
  }
}

module.exports = options => new DpkgFetch(options)
