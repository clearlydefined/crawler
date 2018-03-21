// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const requestRetry = require('requestretry').defaults({ json: true, maxAttempts: 3, fullResponse: true })

const providerMap = {
  nuget: 'https://api.nuget.org'
}

class NugetFetch extends BaseHandler {
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
    request.document = {
      registryData,
      location: registryData.catalogEntry,
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
      `${baseUrl}/v3/registration3/${spec.name}/${spec.revision}.json`
    )
    if (statusCode !== 200 || !body) return null
    return body
  }

  async _getLatestVersion(name) {
    // https://docs.microsoft.com/en-us/nuget/api/package-base-address-resource
    // Example: https://api.nuget.org/v3-flatcontainer/moq/index.json
    const baseUrl = providerMap.nuget
    const { body, statusCode } = await requestRetry.get(`${baseUrl}/v3-flatcontainer/${name}/index.json`)
    // If statusCode is not 200, XML may be returned
    if (statusCode === 200 && body.versions) {
      return body.versions[body.versions.length - 1] // the versions are already sorted
    }
    return null
  }
}

module.exports = options => new NugetFetch(options)
