// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const extract = require('extract-zip')
const decompress = require('decompress')
const decompressTar = require('decompress-tar')
const decompressTarbz2 = require('decompress-tarbz2')
const decompressTargz = require('decompress-targz')
const decompressTarxz = require('decompress-tarxz')
const decompressUnzip = require('decompress-unzip')
const domain = require('domain')
const nodeRequest = require('request')
const fs = require('fs')

class AbstractFetch extends BaseHandler {
  /**
   * Handle the given request in a way appropriate for the given request. Note that this is best
   * to call this AFTER rewriting the request URL (if needed) to ensure consistent processing.
   * @param {Request} request
   */
  handle(request) {
    return super.handle(request)
  }

  // eslint-disable-next-line no-unused-vars
  canHandle(request) {
    return false
  }

  unzip(source, destination) {
    return new Promise((resolve, reject) =>
      extract(source, { dir: destination }, error => (error ? reject(error) : resolve()))
    )
  }

  decompress(source, destination, map) {
    return decompress(source, destination, {
      filter: file => !file.path.endsWith('/'),
      map: map,
      plugins: [decompressTar(), decompressTarbz2(), decompressTargz(), decompressTarxz(), decompressUnzip({ validateEntrySizes: false })]
    })
  }

  async _download(downloadUrl, destination) {
    return new Promise((resolve, reject) => {
      const dom = domain.create()
      dom.on('error', error => reject(error))
      dom.run(() => {
        nodeRequest
          .get(downloadUrl, (error, response) => {
            if (error) return reject(error)
            if (response.statusCode !== 200)
              return reject(new Error(`${response.statusCode} ${response.statusMessage}`))
          })
          .pipe(fs.createWriteStream(destination))
          .on('finish', () => resolve())
      })
    })
  }
}

module.exports = AbstractFetch
