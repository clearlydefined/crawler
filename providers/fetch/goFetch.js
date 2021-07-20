const AbstractFetch = require("./abstractFetch");

const providerMap = {
  googleproxy: 'https://proxy.golang.org/'
}

class GoFetch extends AbstractFetch {

  _buildUrl(spec, extension = '.zip') {
    return `${providerMap[spec.provider]}${spec.namespace}/${spec.name}/@v/${spec.revision}${extension}`
  }
}

module.exports = options => new GoFetch(options)