const AbstractFetch = require("./abstractFetch");

class GoFetch extends AbstractFetch {

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
}

module.exports = options => new GoFetch(options)