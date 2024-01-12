const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const sourceDiscovery = require('../../lib/sourceDiscovery')
const { merge, uniq } = require('lodash')
const SourceSpec = require('../../lib/sourceSpec')

class CondaExtract extends AbstractClearlyDefinedProcessor {
  constructor(options, sourceFinder) {
    super(options)
    this.sourceFinder = sourceFinder
  }

  get toolVersion() {
    return '0.0.1'
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'conda' && spec && spec.type === 'conda'
  }

  async handle(request) {
    if (this.isProcessing(request)) {
      await super.handle(request)
      const spec = this.toSpec(request)
      const { releaseDate, registryData, declaredLicenses } = request.document
      request.document = merge(this.clone(request.document), { releaseDate, registryData, declaredLicenses })
      let sourceCandidates = uniq([
        registryData.channelData.source_url,
        registryData.channelData.home,
        registryData.channelData.dev_url,
        registryData.channelData.doc_url,
        registryData.channelData.doc_source_url].filter(e => e))

      let sourceInfo = undefined
      const githubSource = await this.sourceFinder(
        registryData.repoData.packageData.version, sourceCandidates, {
        githubToken: this.options.githubToken,
        logger: this.logger
      })

      if (githubSource) {
        sourceInfo = githubSource
      } else {
        sourceInfo = SourceSpec.fromObject(spec)
        sourceInfo.type = 'sourcearchive'
      }
      request.document.sourceInfo = sourceInfo
    }
    this.addLocalToolTasks(request)
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.fromObject(request.document.sourceInfo)
      this.linkAndQueue(request, 'source', sourceSpec.toEntitySpec())
    }
    return request
  }
}

module.exports = (options, sourceFinder) => new CondaExtract(options, sourceFinder || sourceDiscovery)