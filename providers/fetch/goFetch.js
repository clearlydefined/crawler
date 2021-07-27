const requestPromise = require("request-promise-native");
const { parseString } = require("xml2js");
const AbstractFetch = require("./abstractFetch");

class GoFetch extends AbstractFetch {
  async handle(request) {
    const spec = this.toSpec(request)

    super.handle(request)


    const artifact = this.createTempFile(request)

    const dir = this.createTempDir(request)
    await this.decompress(artifact.name, dir.name)

    const hashes = await this.computeHashes(artifact.name)

    const info = await this._getInfo(spec)
    const releaseDate = info.Time

    request.document = this._createDocument(dir, releaseDate, hashes)

    return request
  }

  _createDocument(dir, releaseDate, hashes) {
    return { location: dir.name, releaseDate, hashes }
  }

  _buildUrl(spec, extension = '.zip') {
    let initial_url = `https://proxy.golang.org/${spec.provider}/${spec.namespace}/${spec.name}/@v/${spec.revision}${extension}`
    return this._replace_encodings(this._remove_blank_fields(initial_url))
  }

  _remove_blank_fields(url) {
    return `${url.replace(/\-\//g, '')}`
  }

  _replace_encodings(url) {
    return `${url.replace(/%2f/g, '/')}`
  }

  async _getInfo(spec) {
    const url = this._buildUrl(spec, '.info')
    let content

    try {
      content = await requestPromise({ url })
    } catch (error) {
      if (error.statusCode === 404) return null
      else throw error
    }

    return JSON.parse(content.toString())
  }
}


module.exports = options => new GoFetch(options)