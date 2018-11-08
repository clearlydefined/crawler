// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { clone } = require('lodash')
const BaseHandler = require('../../lib/baseHandler')
const request = require('request-promise-native')
const fs = require('fs')
const path = require('path')

class CrateFetch extends BaseHandler {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'cratesio'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    const { manifest, version } = await this._getRegistryData(spec)
    if (!version) return request
    spec.revision = version.num
    request.url = spec.toUrl()
    const dir = this._createTempDir(request)
    const location = await this._getPackage(dir, version)
    request.document = {
      registryData: version,
      releaseDate: version.created_at,
      location,
      manifest
    }
    request.contentOrigin = 'origin'
    if (version.crate) {
      request.casedSpec = clone(spec)
      request.casedSpec.name = version.crate
    }
    return request
  }

  async _getRegistryData(spec) {
    let registryData
    try {
      registryData = await request({
        url: `https://crates.io/api/v1/crates/${spec.name}`,
        json: true
      })
    } catch (exception) {
      if (exception.statusCode === 404) throw new Error(`404 crate not found - ${spec.name}`)
      throw exception
    }
    if (!registryData.versions) return null
    const version = spec.revision || this.getLatestVersion(registryData.versions.map(x => x.num))
    return {
      manifest: registryData.crate,
      version: registryData.versions.find(x => x.num === version)
    }
  }

  async _getPackage(dir, version) {
    const zip = path.join(dir.name, 'crate.zip')
    const crate = path.join(dir.name, 'crate')
    return new Promise((resolve, reject) => {
      request({ url: `https://crates.io${version.dl_path}`, json: false, encoding: null }).pipe(
        fs
          .createWriteStream(zip)
          .on('finish', async () => {
            await this.decompress(zip, crate)
            resolve(path.join(crate, `${version.crate}-${version.num}`))
          })
          .on('error', reject)
      )
    })
  }
}

module.exports = options => new CrateFetch(options)
