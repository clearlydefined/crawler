// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const { trimStart, clone, get } = require('lodash')
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const requestRetry = require('requestretry').defaults({ maxAttempts: 3, fullResponse: true })

const providerMap = {
  nuget: 'https://api.nuget.org'
}

class NuGetFetch extends AbstractFetch {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'nuget'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    spec.revision = this._normalizeVersion(spec.revision || (await this._getLatestVersion(spec.name)))
    // rewrite the request URL as it is used throughout the system to derive locations and urns etc.
    request.url = spec.toUrl()
    const registryData = await this._getRegistryData(spec)
    const manifest = registryData ? await this._getManifest(registryData.catalogEntry) : null
    const nuspec = manifest ? await this._getNuspec(spec) : null
    if (!registryData || !nuspec || !manifest) return request.markSkip('Missing  ')
    super.handle(request)
    const dir = this.createTempDir(request)
    const location = await this._persistMetadata(dir, manifest, nuspec)
    const zip = path.join(dir.name, 'nupkg.zip')
    await this._getPackage(zip, registryData.packageContent)
    location.nupkg = path.join(dir.name, 'nupkg')
    await this.decompress(zip, location.nupkg)
    request.document = {
      registryData,
      location,
      releaseDate: registryData ? new Date(registryData.published).toISOString() : null,
      hashes: await this.computeHashes(zip)
    }
    request.contentOrigin = 'origin'
    if (get(manifest, 'id')) {
      request.casedSpec = clone(spec)
      request.casedSpec.name = manifest.id
    }
    return request
  }

  // query nuget to get the latest version if we don't already have that.
  async _getRegistryData(spec) {
    const baseUrl = providerMap.nuget
    // https://docs.microsoft.com/en-us/nuget/api/registration-base-url-resource
    // Example: https://api.nuget.org/v3/registration3/moq/4.8.2.json and follow catalogEntry
    const { body, statusCode } = await requestRetry.get(
      `${baseUrl}/v3/registration3/${spec.name.toLowerCase()}/${spec.revision}.json`,
      { json: true }
    )
    return statusCode !== 200 || !body ? null : body
  }

  // https://docs.microsoft.com/en-us/nuget/reference/package-versioning#normalized-version-numbers
  _normalizeVersion(version) {
    const parts = version.split('-')
    const trimmed = parts[0].split('.').map(part => trimStart(part, '0') || '0')
    return [(trimmed[3] === '0' ? trimmed.slice(0, 3) : trimmed).join('.'), ...parts.slice(1)].filter(x => x).join('-')
  }

  async _getLatestVersion(name) {
    // https://docs.microsoft.com/en-us/nuget/api/package-base-address-resource
    // Example: https://api.nuget.org/v3-flatcontainer/moq/index.json
    const baseUrl = providerMap.nuget
    const { body, statusCode } = await requestRetry.get(`${baseUrl}/v3-flatcontainer/${name}/index.json`, {
      json: true
    })
    // If statusCode is not 200, XML may be returned
    if (statusCode === 200 && body.versions) {
      const versions = body.versions.filter(version => !version.includes('build'))
      return versions[versions.length - 1] // the versions are already sorted
    }
    return null
  }

  async _getPackage(zip, packageContentUrl) {
    return new Promise((resolve, reject) => {
      requestRetry
        .get(packageContentUrl, { json: false, encoding: null })
        .pipe(fs.createWriteStream(zip))
        .on('finish', () => resolve(null))
        .on('error', reject)
    })
  }

  async _getManifest(catalogEntryUrl) {
    // Example: https://api.nuget.org/v3/catalog0/data/2018.10.29.04.23.22/xunit.core.2.4.1.json
    const { body, statusCode } = await requestRetry.get(catalogEntryUrl)
    if (statusCode !== 200) return null
    return JSON.parse(body)
  }

  // Nuspec is needed because package metadata API is not able to parse repository URL: https://github.com/NuGet/NuGetGallery/issues/5671
  async _getNuspec(spec) {
    // https://docs.microsoft.com/en-us/nuget/api/package-base-address-resource#download-package-manifest-nuspec
    // Example: https://api.nuget.org/v3-flatcontainer/newtonsoft.json/11.0.1/newtonsoft.json.nuspec
    const { body, statusCode } = await requestRetry.get(
      `https://api.nuget.org/v3-flatcontainer/${spec.name}/${spec.revision}/${spec.name}.nuspec`
    )
    if (statusCode !== 200) return null
    return body
  }

  async _persistMetadata(dir, manifest, nuspec) {
    const location = {
      manifest: path.join(dir.name, 'manifest.json'),
      nuspec: path.join(dir.name, 'nuspec.xml')
    }
    await Promise.all([
      promisify(fs.writeFile)(location.manifest, JSON.stringify(manifest)),
      promisify(fs.writeFile)(location.nuspec, nuspec)
    ])
    return location
  }
}

module.exports = options => new NuGetFetch(options)
