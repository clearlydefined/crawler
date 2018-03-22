// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const requestRetry = require('requestretry').defaults({ maxAttempts: 3, fullResponse: true })

const providerMap = {
  nuget: 'https://api.nuget.org'
}

class NuGetFetch extends BaseHandler {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'nuget'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    // if there is no revision, return an empty doc. The processor will find
    const registryData = await this._getRegistryData(request)
    // rewrite the request URL as it is used throughout the system to derive locations and urns etc.
    request.url = spec.toUrl()
    const manifest = registryData ? await this._getManifest(registryData.catalogEntry) : null
    const nuspec = await this._getNuspec(spec)
    const location = await this._persistMetadata(request, manifest, nuspec)
    request.document = {
      registryData,
      location,
      releaseDate: new Date(registryData.published).toISOString()
    }
    request.contentOrigin = 'origin'
    return request
  }

  // query nuget to get the latest version if we don't already have that.
  async _getRegistryData(request) {
    const spec = this.toSpec(request)
    spec.revision = spec.revision || (await this._getLatestVersion(spec.name))
    const baseUrl = providerMap.nuget
    // https://docs.microsoft.com/en-us/nuget/api/registration-base-url-resource
    // Example: https://api.nuget.org/v3/registration3/moq/4.8.2.json and follow catalogEntry
    const { body, statusCode } = await requestRetry.get(
      `${baseUrl}/v3/registration3/${spec.name.toLowerCase()}/${spec.revision}.json`,
      { json: true }
    )
    if (statusCode !== 200 || !body) return null
    return body
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
      return body.versions[body.versions.length - 1] // the versions are already sorted
    }
    return null
  }

  async _getManifest(catalogEntryUrl) {
    const { body, statusCode } = await requestRetry.get(catalogEntryUrl)
    if (statusCode !== 200) return null
    return body
  }

  // Nuspec is needed because package metadata API is not able to parse repository URL: https://github.com/NuGet/Home/issues/6725
  async _getNuspec(spec) {
    // https://docs.microsoft.com/en-us/nuget/api/package-base-address-resource#download-package-manifest-nuspec
    // Example: https://api.nuget.org/v3-flatcontainer/newtonsoft.json/11.0.1/newtonsoft.json.nuspec
    const { body, statusCode } = await requestRetry.get(
      `https://api.nuget.org/v3-flatcontainer/${spec.name}/${spec.revision}/${spec.name}.nuspec`
    )
    if (statusCode !== 200) return []
    return body
  }

  async _persistMetadata(request, manifest, nuspec) {
    const dir = this._createTempDir(request)
    const location = { manifest: path.join(dir.name, 'manifest.json'), nuspec: path.join(dir.name, 'nuspec.xml') }
    await Promise.all([
      promisify(fs.writeFile)(location.manifest, manifest),
      promisify(fs.writeFile)(location.nuspec, nuspec)
    ])
    return location
  }
}

module.exports = options => new NuGetFetch(options)
