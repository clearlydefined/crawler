const { clone } = require('lodash')
const requestPromise = require('request-promise-native')
const AbstractFetch = require('./abstractFetch')
const nodeRequest = require('request')
const fs = require('fs')
const axios = require('axios')
const { default: axiosRetry, exponentialDelay, isNetworkOrIdempotentRequestError } = require('axios-retry')
const { parse: htmlParser } = require('node-html-parser')
const { parse: spdxParser } = require('@clearlydefined/spdx')

class GoFetch extends AbstractFetch {
  constructor(options) {
    super(options)

    axiosRetry(axios, {
      retries: 5,
      retryDelay: exponentialDelay,
      retryCondition: (err) => {
        return isNetworkOrIdempotentRequestError(err) || err.response?.status == 429
      }
    })
    this.options.http = options.http || axios
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'golang'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    if (!spec.revision) spec.revision = await this._getLatestVersion(spec)
    if (!spec.revision) return this.markSkip(request)

    request.url = spec.toUrl()

    super.handle(request)

    const info = await this._getInfo(spec)
    if (!info) return this.markSkip(request)

    const artifact = this.createTempFile(request)
    const artifactResult = await this._getArtifact(spec, artifact.name)
    if (!artifactResult) return this.markSkip(request)

    const dir = this.createTempDir(request)

    await this.decompress(artifact.name, dir.name)

    const hashes = await this.computeHashes(artifact.name)
    const releaseDate = info.Time

    let registryData
    try {
      registryData = await this._getRegistryData(spec)
    } catch (err) {
      if (err instanceof RequeueError && (request.attemptCount === undefined || request.attemptCount < this.options.maxRequeueAttemptCount)) {
        return request.markRequeue('Throttled', err.message)
      }
    }

    request.document = this._createDocument(dir, releaseDate, hashes, registryData)
    request.contentOrigin = 'origin'
    request.casedSpec = clone(spec)

    return request
  }

  async _getLatestVersion(spec) {
    const initial_url = `https://${spec.provider}/${spec.namespace}/${spec.name}/@v/list`
    const replace_encoded_url = this._replace_encodings(initial_url)
    const url = replace_encoded_url.replace(/null\//g, '')

    const response = await requestPromise({ url })
    const versions = response.toString().split('\n').sort()

    // return last version in sorted versions array
    return versions[versions.length - 1]
  }

  _convert_to_versions_array(versions_string) {
    versions_string.split('\n').sort()
  }

  _createDocument(dir, releaseDate, hashes, registryData) {
    return { location: dir.name, releaseDate, hashes, registryData }
  }

  _buildUrl(spec, extension = '.zip') {
    let initial_url = `https://proxy.golang.org/${spec.namespace}/${spec.name}/@v/${spec.revision}${extension}`
    return this._replace_encodings(this._remove_blank_fields(initial_url))
  }

  _remove_blank_fields(url) {
    return `${url.replace(/-\//g, '')}`
  }

  _replace_encodings(url) {
    return `${url.replace(/%2f/ig, '/')}`
  }

  async _getArtifact(spec, destination) {
    const url = this._buildUrl(spec)

    const status = await new Promise(resolve => {
      nodeRequest
        .get(url, (error, response) => {
          if (error) this.logger.error(this._google_proxy_error_string(error))
          if (response.statusCode !== 200) return resolve(false)
        })
        .pipe(fs.createWriteStream(destination).on('finish', () => resolve(true)))
    })

    if (status) return true
  }

  async _getInfo(spec) {
    const url = this._buildUrl(spec, '.info')
    let content

    try {
      content = await requestPromise({ url })
    } catch (error) {
      if (error.statusCode === 404) return null
      else throw this._google_proxy_error_string(error)
    }

    return JSON.parse(content.toString())
  }

  async _getRegistryData(spec) {
    const registryLicenseUrl = this._replace_encodings(
      this._remove_blank_fields(`https://pkg.go.dev/${spec.namespace}/${spec.name}@${spec.revision}?tab=licenses`)
    )
    try {
      // Based on this discussion https://github.com/golang/go/issues/36785, there is no API for pkg.go.dev for now.
      const response = await this.options.http.get(registryLicenseUrl)
      const root = htmlParser(response.data)
      // Here is the license html template file.
      // https://github.com/golang/pkgsite/blob/master/static/frontend/unit/licenses/licenses.tmpl
      const licenses = root.querySelectorAll('[id^=#lic-]').map(ele => ele.textContent)
      if (this._validateLicenses(licenses)) {
        return {
          licenses
        }
      } else {
        this.logger.info(`Licenses from html could not be parsed. The licenses are ${JSON.stringify(licenses)}.`)
      }
    } catch (err) {
      if (err.response?.status === 404) {
        // Based on https://pkg.go.dev/about#adding-a-package, packages on pkg.go.dev may be
        // removed from pkg.go.dev when calling the API. Therefore, just log it.
        this.logger.info(`Could not find the component in ${registryLicenseUrl}`)
        return
      }
      if (err.response?.status === 429) {
        const msg = `Too many calls to pkg.go.dev. Current call is ${registryLicenseUrl}`
        this.logger.info(msg)
        throw new RequeueError(msg)
      }
      this.logger.info(`Getting declared license from pkg.go.dev failed. ${JSON.stringify(err.response?.data || err.request || err.message)}`)
    }
  }

  _google_proxy_error_string(error) {
    return `Error encountered when querying proxy.golang.org. Please check whether the component has a valid go.mod file. ${error}`
  }

  _validateLicenses(licenses) {
    for (const license of licenses) {
      for (const part of license.split(', ')) {
        const tmp = spdxParser(part)
        if (tmp.noassertion) {
          return false
        }
      }
    }
    return true
  }
}

class RequeueError extends Error {
  constructor(message) {
    super(message)
  }
}

module.exports = options => new GoFetch(options)