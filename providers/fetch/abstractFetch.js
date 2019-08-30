// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const extract = require('extract-zip')
const decompress = require('decompress')
const decompressTar = require('decompress-tar')
const decompressTargz = require('decompress-targz')
const decompressTarxz = require('decompress-tarxz')
const decompressUnzip = require('decompress-unzip')

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

  decompress(source, destination) {
    return decompress(source, destination, {
      filter: file => !file.path.endsWith('/'),
      plugins: [decompressTar(), decompressTargz(), decompressTarxz(), decompressUnzip({ validateEntrySizes: false })]
    })
  }
}

module.exports = AbstractFetch
