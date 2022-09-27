// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const nodeRequest = require('request')
const requestRetry = require('requestretry').defaults({ maxAttempts: 3, fullResponse: true })
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')
const { clone, get } = require('lodash')
const FetchResult = require('../../lib/fetchResult')
const { extractDate } = require('../../lib/utils')

const providerMap = {
  rubyGems: 'https://rubygems.org'
}

class RubyGemsFetch extends AbstractFetch {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'rubygems'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    const registryData = await this._getRegistryData(spec)
    if (!registryData) return request.markSkip('Missing registryData')
    spec.revision = spec.revision || registryData.version
    if (!spec.revision) return request.markSkip('Missing revision')
    request.url = spec.toUrl()
    super.handle(request)
    const file = this.createTempFile(request)
    await this._getPackage(spec, file.name)
    const dir = this.createTempDir(request)
    await this.decompress(file.name, dir.name)
    await this._extractFiles(dir.name)
    const hashes = await this.computeHashes(file.name)

    const fetchResult = new FetchResult(request.url)
    fetchResult.document = await this._createDocument(dir, registryData, hashes)
    if (get(registryData, 'name')) {
      fetchResult.casedSpec = clone(spec)
      fetchResult.casedSpec.name = registryData.name
    }
    request.fetchResult = fetchResult.adoptCleanup(dir, request)
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
    const fullName = spec.namespace ? `${spec.namespace}/${spec.name}` : spec.name
    const gemUrl = `${providerMap.rubyGems}/gems/${fullName}-${spec.revision}.gem`
    return new Promise((resolve, reject) => {
      nodeRequest
        .get(gemUrl, (error, response) => {
          if (error) return reject(error)
          if (response.statusCode !== 200) reject(new Error(`${response.statusCode} ${response.statusMessage}`))
        })
        .pipe(fs.createWriteStream(destination).on('finish', () => resolve(null)))
    })
  }

  async _createDocument(dir, registryData, hashes) {
    const releaseDate = await this._extractReleaseDate(dir.name)
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

  async _extractReleaseDate(dirName) {
    if (fs.existsSync(path.join(dirName, 'metadata.txt'))) {
      const file = fs.readFileSync(`${dirName}/metadata.txt`, 'utf8')
      const regexp = /date:\s\d{4}-\d{1,2}-\d{1,2}/
      const releaseDate = file.match(regexp)
      const validReleaseDate = extractDate(releaseDate[0]?.substring(5).trim())
      if (validReleaseDate) return validReleaseDate.toJSDate().toISOString()

      //infer the release date from mTime of the decompressed metadata.gz
      const metadata = path.join(dirName, 'metadata.gz')
      const stats = await fs.promises.stat(metadata)
      return stats.mtime.toISOString()
    }
  }
}

module.exports = options => new RubyGemsFetch(options)
