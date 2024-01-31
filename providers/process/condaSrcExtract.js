const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const { merge } = require('lodash')

class CondaSrcExtract extends AbstractClearlyDefinedProcessor {
  constructor(options) {
    super(options)
  }

  get toolVersion() {
    return '0.0.1'
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'clearlydefined' && spec && spec.type === 'condasrc'
  }

  async handle(request) {
    await super.handle(request)
    const { releaseDate, registryData, declaredLicenses } = request.document
    request.document = merge(this.clone(request.document), { releaseDate, registryData, declaredLicenses })
  }
}

module.exports = options => new CondaSrcExtract(options)
