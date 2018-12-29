// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const nodeRequest = require('request')
const requestRetry = require('requestretry').defaults({ maxAttempts: 3, fullResponse: true })
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')
const { clone } = require('lodash')

const providerMap = {
  rubyGems: 'https://rubygems.org'
}

class RubyGemsFetch extends BaseHandler {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'rubygems'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    const registryData = await this._getRegistryData(spec)
    spec.revision = spec.revision || registryData ? registryData.version : null
    request.url = spec.toUrl()
    const file = this._createTempFile(request)
    await this._getPackage(spec, file.name)
    const dir = this._createTempDir(request)
    await this.decompress(file.name, dir.name)
    await this._extractFiles(dir.name)
    const hashes = await this.computeHashes(file.name)
    request.document = await this._createDocument(dir, registryData, hashes)
    request.contentOrigin = 'origin'
    if (registryData.name) {
      request.casedSpec = clone(spec)
      request.casedSpec.name = registryData.name
    }
    return request
  }

  async _getRegistryData(spec) {
    const baseUrl = providerMap.rubyGems
    const { body, statusCode } = await requestRetry.get(`${baseUrl}/api/v1/gems/${spec.name}.json`, {
      json: true
    })
    return statusCode === 200 && body ? body : null
  }

  async _getPackage(spec, destination) {
    return new Promise((resolve, reject) => {
      nodeRequest
        .get(this._buildUrl(spec), (error, response) => {
          if (error) return reject(error)
          if (response.statusCode !== 200) reject(new Error(`${response.statusCode} ${response.statusMessage}`))
        })
        .pipe(fs.createWriteStream(destination).on('finish', () => resolve(null)))
    })
  }

  _buildUrl(spec) {
    const fullName = spec.namespace ? `${spec.namespace}/${spec.name}` : spec.name
    return `${providerMap.rubyGems}/downloads/${fullName}-${spec.revision}.gem`
  }

  _createDocument(dir, registryData, hashes) {
    const releaseDate = this._extractReleaseDate(dir.name)
    return { location: dir.name + '/data', registryData, releaseDate, hashes }
  }

  async _extractFiles(dirName) {
    if (fs.existsSync(path.join(dirName, 'metadata.gz'))) {
      await new Promise((resolve, reject) => {
        fs.createReadStream(`${dirName}/metadata.gz`)
          .pipe(zlib.createGunzip())
          .on('data', data => {
            fs.writeFile(`${dirName}/metadata.txt`, data, error => {
              if (error) return reject(error)
              return resolve()
            })
          })
      })
    }
    if (fs.existsSync(path.join(dirName, 'data.tar.gz')))
      await this.decompress(`${dirName}/data.tar.gz`, `${dirName}/data`)
  }

  _extractReleaseDate(dirName) {
    if (fs.existsSync(path.join(dirName, 'metadata.txt'))) {
      const file = fs.readFileSync(`${dirName}/metadata.txt`, 'utf8')
      const regexp = /date:\s\d{4}-\d{1,2}-\d{1,2}/
      const releaseDate = file.match(regexp)
      if (!releaseDate) return null
      return releaseDate[0] ? releaseDate[0].substring(5).trim() : null
    }
  }
}

module.exports = options => new RubyGemsFetch(options)
