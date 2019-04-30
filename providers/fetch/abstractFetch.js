// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const Request = require('ghcrawler').request
const extract = require('extract-zip')
const decompress = require('decompress')
const decompressTar = require('decompress-tar')
const decompressTargz = require('decompress-targz')
const decompressUnzip = require('decompress-unzip')
const decompressTarxz = require('decompress-tarxz')

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
      plugins: [decompressTar(), decompressTargz(), decompressUnzip({ validateEntrySizes: false }), decompressTarxz()]
    })
  }

  /*
   * This is used to jump detween queue sets when the current crawler does not support the type requested
   */
  async queueSpecific(request, spec) {
    const containedTypes = new Set(['docker', 'apk'])
    const defaultTypes = new Set(['dpkg'])
    let service
    if (containedTypes.has(spec.type)) service = require('../../').containedService
    else if (defaultTypes.has(spec.type)) service = require('../../').defaultService
    else throw new Error(`Nowhere to queue type ${spec.type}`)
    if (!service) return
    await service.ensureInitialized()
    service.queue(new Request(spec.type, spec.toUrl()))
    return request.markSkip('Transferred  ')
  }
}

module.exports = AbstractFetch
