// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const fs = require('fs')
const path = require('path')
const request = require('request')
var zlib = require('zlib')
const decompressGz = require('decompress-gz')

class GemExtract extends BaseHandler {
  get schemaVersion() {
    return 1
  }

  get toolSpec() {
    return { tool: 'clearlydefined', toolVersion: this.schemaVersion }
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'gem' && spec && spec.type === 'gem'
  }

  async handle(request) {
    console.log('gem extract')
    if (this.isProcessing(request)) {
      const { document, spec } = super._process(request)
      this.addBasicToolLinks(request, spec)
      const location = this._getMetadataLocation(request.document.location)
    }
  }

  async _getMetadataLocation(dir) {
    if (fs.existsSync(path.join(dir, 'metadata.gz'))) {
      await this.decompress(path.join(dir, 'metadata.gz'), dir, {
        plugins: [decompressGz()]
      })
      // const gzBuffer = fs.createReadStream(`${dir}/metadata.gz`, { encoding: 'utf8' })
      // const output = fs.createWriteStream(`${dir}/metadata.yaml`)
      // await zlib
      //   .createGunzip()
      //   .pipe(gzBuffer)
      //   .pipe(output)
      return path.join(dir, 'metadata.yaml')
    }
    return null
  }
}

module.exports = options => new GemExtract(options)
