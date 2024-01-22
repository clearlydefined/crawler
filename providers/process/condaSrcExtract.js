const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const { merge } = require('lodash')

class CondaSrcExtract extends AbstractClearlyDefinedProcessor {
  constructor(options, sourceFinder) {
    super(options)
    this.sourceFinder = sourceFinder
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

module.exports = (options, sourceFinder) => new CondaSrcExtract(options, sourceFinder || sourceDiscovery)