const AbstractFetch = require("./abstractFetch");

const providerMap = {
  googleproxy: 'https://proxy.golang.org/'
}

class GoFetch extends AbstractFetch {

  _buildUrl(spec, extension = '.zip') {
    const fullName = `${spec.namespace.replace(/\./g, '/')}/${spec.name}`
    return `${providerMap[spec.provider]}${fullName}/@v/${spec.revision}${extension}`
  }
}

module.exports = options => new GoFetch(options)