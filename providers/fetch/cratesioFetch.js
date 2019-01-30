// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { clone } = require('lodash')
const AbstractFetch = require('./abstractFetch')
const request = require('request-promise-native')
const fs = require('fs')
const path = require('path')

class CratesioFetch extends AbstractFetch {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'cratesio'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    const registryData = await this._getRegistryData(spec)
    if (!registryData || !registryData.version) return this.markSkip(request)
    const version = registryData.version
    spec.revision = version.num
    request.url = spec.toUrl()
    super.handle(request)
    const dir = this.createTempDir(request)
    const zip = path.join(dir.name, 'crate.zip')
    await this._getPackage(zip, version)
    const crateDir = path.join(dir.name, 'crate')
    await this.decompress(zip, crateDir)
    const location = path.join(crateDir, `${version.crate}-${version.num}`)
    request.document = {
      registryData: version,
      releaseDate: version.created_at,
      location,
      hashes: await this.computeHashes(zip),
      manifest: registryData.manifest
    }
    request.contentOrigin = 'origin'
    if (version.crate) {
      request.casedSpec = clone(spec)
      request.casedSpec.name = version.crate
    }
    return request
  }

  // Example: https://crates.io/api/v1/crates/bitflags
  async _getRegistryData(spec) {
    let registryData
    try {
      registryData = await request({
        url: `https://crates.io/api/v1/crates/${spec.name}`,
        json: true
      })
    } catch (exception) {
      if (exception.statusCode !== 404) throw exception
      return null
    }
    if (!registryData.versions) return null
    const version = spec.revision || this.getLatestVersion(registryData.versions.map(x => x.num))
    return {
      manifest: registryData.crate,
      version: registryData.versions.find(x => x.num === version)
    }
  }

  // Example: https://crates.io/api/v1/crates/bitflags/1.0.4/download
  async _getPackage(zip, version) {
    return new Promise((resolve, reject) => {
      request({ url: `https://crates.io${version.dl_path}`, json: false, encoding: null }).pipe(
        fs
          .createWriteStream(zip)
          .on('finish', () => resolve(null))
          .on('error', reject)
      )
    })
  }
}

module.exports = options => new CratesioFetch(options)
