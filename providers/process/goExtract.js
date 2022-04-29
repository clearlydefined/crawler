const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const sourceDiscovery = require('../../lib/sourceDiscovery')
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

  get toolVersion() {
    return '1.0.0'
  }

  async handle(request) {
    if (this.isProcessing(request)) {
      await super.handle(request)
      const spec = this.toSpec(request)
      this._createDocument(request, spec)
    }
    this.linkAndQueueTool(request, 'licensee')
    this.linkAndQueueTool(request, 'scancode')
    this.linkAndQueueTool(request, 'reuse')
  }

  _createDocument(request) {
    request.document = merge(this.clone(request.document))
  }
}

module.exports = (options, sourceFinder) => new GoExtract(options, sourceFinder || sourceDiscovery)