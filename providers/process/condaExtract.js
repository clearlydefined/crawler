const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const { merge } = require('lodash')
const SourceSpec = require('../../lib/sourceSpec')

class CondaExtract extends AbstractClearlyDefinedProcessor {
  constructor(options, sourceFinder) {
    super(options)
    this.sourceFinder = sourceFinder
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && (spec.type == 'conda' || spec.type == 'condasrc')
  }

  async handle(request) {
    if (this.isProcessing(request)) {
      await super.handle(request)
      const spec = this.toSpec(request)
      const { releaseDate, registryData, declaredLicenses } = request.document
      request.document = merge(this.clone(request.document), { releaseDate, registryData, declaredLicenses })
      let sourceCandidates = [registryData.channelData.home,
      registryData.channelData.dev_url,
      registryData.channelData.doc_url,
      registryData.channelData.doc_source_url,
      registryData.channelData.source_url].filter(e => e)
      const sourceInfo = await this.sourceFinder(spec.type == 'conda' ? registryData.repoData.packageData.version
        : registryData.channelData.vesion
        , sourceCandidates, {
        githubToken: this.options.githubToken,
        logger: this.logger
      })
      if (sourceInfo) {
        request.document.sourceInfo = sourceInfo
      }
    }

    ['licensee', 'scancode', 'reuse', 'fossology'].forEach(x => this.linkAndQueueTool(request, x, undefined, 'local'))
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.fromObject(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
    return request
  }
}


module.exports = (options, sourceFinder) => new CondaExtract(options, sourceFinder || sourceDiscovery)