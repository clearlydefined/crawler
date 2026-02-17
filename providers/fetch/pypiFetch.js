// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const requestRetry = require('./requestRetryWithDefaults')
const nodeRequest = require('../../lib/fetch')
const fs = require('fs')
const spdxCorrect = require('spdx-correct')
const { findLastKey, get, find, clone } = require('lodash')
const FetchResult = require('../../lib/fetchResult')

const providerMap = {
  pypi: 'https://pypi.python.org'
}

class PyPiFetch extends AbstractFetch {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'pypi'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    const registryData = await this._getRegistryData(spec)
    if (!registryData) return request.markSkip('Missing  ')
    spec.revision = spec.revision ? spec.revision : this._getRevision(registryData)
    request.url = spec.toUrl()
    super.handle(request)
    const file = this.createTempFile(request)
    const downloaded = await this._getPackage(spec, registryData, file.name)
    if (!downloaded) return request.markSkip('Missing  ')

    const dir = this.createTempDir(request)
    await this.decompress(file.name, dir.name)
    const hashes = await this.computeHashes(file.name)

    const fetchResult = new FetchResult(request.url)
    fetchResult.document = await this._createDocument(dir, spec, registryData, hashes)
    if (get(registryData, 'info.name')) {
      fetchResult.casedSpec = clone(spec)
      fetchResult.casedSpec.name = registryData.info.name
    }
    request.fetchResult = fetchResult.adoptCleanup(dir, request)
    return request
  }

  async _getRegistryData(spec) {
    const baseUrl = providerMap.pypi
    const { body, statusCode } = await requestRetry.get(`${baseUrl}/pypi/${spec.name}/json`, {
      json: true
    })
    if (statusCode !== 200 || !body) return null
    return body
  }

  _getRevision(registryData) {
    if (!registryData || !registryData.releases) return null
    return findLastKey(registryData.releases)
  }

  _createDocument(dir, spec, registryData, hashes) {
    const releaseDate = this._extractReleaseDate(spec, registryData)
    const declaredLicense = this._extractDeclaredLicense(registryData)
    return { location: dir.name, registryData, releaseDate, declaredLicense, hashes }
  }

  _extractReleaseDate(spec, registryData) {
    const releaseTypes = get(registryData, ['releases', spec.revision])
    const release = find(releaseTypes, entry => {
      return entry.url && entry.url.length > 6 && entry.url.slice(-6) === 'tar.gz'
    })
    if (!release) return
    return release.upload_time
  }

  _extractLicenseFromClassifiers(registryData) {
    const classifiers = get(registryData, 'info.classifiers')
    if (!classifiers) return null
    for (const classifier in classifiers) {
      if (classifiers[classifier].includes('License :: OSI Approved ::')) {
        const lastColon = classifiers[classifier].lastIndexOf(':')
        return classifiers[classifier].slice(lastColon + 1)
      }
    }
    return null
  }

  _extractDeclaredLicense(registryData) {
    const licenseInMetadata = get(registryData, 'info.license')
    const hasVersionInMeta = /\d+/.test(licenseInMetadata)
    const licenseInClassifiers = this._extractLicenseFromClassifiers(registryData)
    const hasVersionInClassifier = /\d+/.test(licenseInClassifiers)

    let licenses = [licenseInMetadata, licenseInClassifiers]
    if (hasVersionInClassifier && !hasVersionInMeta) licenses = [licenseInClassifiers, licenseInMetadata]
    for (const rawLicense of licenses) {
      const parsed = rawLicense && spdxCorrect(rawLicense)
      if (parsed) return parsed
    }
  }

  async _getPackage(spec, registryData, destination) {
    const releaseTypes = get(registryData, ['releases', spec.revision])
    const release = find(releaseTypes, entry => entry.url?.endsWith('tar.gz') || entry.url?.endsWith('zip'))
    if (!release) return false
    const response = await nodeRequest.getStream(release.url)
    if (response.statusCode !== 200) throw new Error(`${response.statusCode} ${response.message}`)
    return new Promise(resolve => {
      response.data.pipe(fs.createWriteStream(destination)).on('finish', () => resolve(true))
    })
  }
}

module.exports = options => new PyPiFetch(options)
