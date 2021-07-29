const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')

class GoExtract extends AbstractClearlyDefinedProcessor {
  constructor(options, sourceFinder) {
    super(options)
    this.sourceFinder = sourceFinder
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'go' && spec && spec.type === 'go'
  }
}

module.exports = (options, sourceFinder) => new GoExtract(options, sourceFinder || sourceDiscovery)