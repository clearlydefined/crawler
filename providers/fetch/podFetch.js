// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { clone } = require('lodash')
const BaseHandler = require('../../lib/baseHandler')
const request = require('request-promise-native')
const fs = require('fs')
const path = require('path')

class PodFetch extends BaseHandler {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'cocoapods'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    const registryData = await this._getRegistryData(spec)
    if (!registryData || !registryData.version) return request.markSkip('Missing  ')
    spec.revision = registryData.version.num
    request.url = spec.toUrl()
    const dir = this._createTempDir(request)
    const location = await this._getPackage(dir, registryData.version)
    request.document = {
      registryData: registryData.version,
      releaseDate: registryData.version.created_at,
      location,
      manifest: registryData.manifest
    }
    request.contentOrigin = 'origin'
    // if (registryData.version.crate) {
    //   request.casedSpec = clone(spec)
    //   request.casedSpec.name = registryData.version.crate
    // }
    return request
  }

  async _getRegistryData(spec) {
    let registryData
    try {
      // registryData = await request({
      //   url: `https://crates.io/api/v1/crates/${spec.name}`,
      //   json: true
      // })
    } catch (exception) {
      if (exception.statusCode !== 404) throw exception
      return null
    }
    if (!registryData.versions) return null
    const version = spec.revision || this.getLatestVersion(registryData.versions.map(x => x.num))
    return {
      //manifest: registryData.crate,
      // version: registryData.versions.find(x => x.num === version)
    }
  }

  async _getPackage(dir, version) {
    // const zip = path.join(dir.name, 'crate.zip')
    // const crate = path.join(dir.name, 'crate')
    // return new Promise((resolve, reject) => {
    //   request({ url: `https://crates.io${version.dl_path}`, json: false, encoding: null }).pipe(
    //     fs
    //       .createWriteStream(zip)
    //       .on('finish', async () => {
    //         await this.decompress(zip, crate)
    //         resolve(path.join(crate, `${version.crate}-${version.num}`))
    //       })
    //       .on('error', reject)
    //   )
    // })
  }
}

module.exports = options => new PodFetch(options)
