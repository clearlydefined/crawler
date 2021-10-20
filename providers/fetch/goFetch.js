const { clone } = require('lodash')
const requestPromise = require('request-promise-native')
const AbstractFetch = require('./abstractFetch')
const nodeRequest = require('request')
const fs = require('fs')

class GoFetch extends AbstractFetch {

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

    request.document = this._createDocument(dir, releaseDate, hashes)
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

  _createDocument(dir, releaseDate, hashes) {
    return { location: dir.name, releaseDate, hashes }
  }

  _buildUrl(spec, extension = '.zip') {
    let initial_url = `https://proxy.golang.org/${spec.namespace}/${spec.name}/@v/${spec.revision}${extension}`
    return this._replace_encodings(this._remove_blank_fields(initial_url))
  }

  _remove_blank_fields(url) {
    return `${url.replace(/-\//g, '')}`
  }

  _replace_encodings(url) {
    return `${url.replace(/%2f/g, '/')}`
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

  _google_proxy_error_string(error) {
    return `Error encountered when querying proxy.golang.org. Please check whether the component has a valid go.mod file. ${error}`
  }
}


module.exports = options => new GoFetch(options)