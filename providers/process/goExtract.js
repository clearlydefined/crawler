const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const SourceSpec = require('../../lib/sourceSpec')
const { merge } = require('lodash')

class GoExtract extends AbstractClearlyDefinedProcessor {
  constructor(options, sourceFinder) {
    super(options)
    this.sourceFinder = sourceFinder
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'go' && spec && spec.type === 'go'
  }

  // Placeholder until I figure out what to put here
  get toolVersion() {
    return '0.0.0'
  }

  async handle(request) {
    if (this.isProcessing(request)) {
      await super.handle(request)
      const spec = this.toSpec(request)
      this.createDocument(request, spec)
    }
  }

  createDocument(request) {
    request.document = merge(this.clone(request.document))
  }
}

module.exports = (options, sourceFinder) => new GoExtract(options, sourceFinder || sourceDiscovery)