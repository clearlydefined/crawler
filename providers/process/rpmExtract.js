// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
// THF
const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const { merge } = require('lodash')
const SourceSpec = require('../../lib/sourceSpec')
const sourceDiscovery = require('../../lib/sourceDiscovery')

class RpmExtract extends AbstractClearlyDefinedProcessor {
  constructor(options, sourceFinder) {
    super(options)
    this.sourceFinder = sourceFinder
  }

  get toolVersion() {
    return '1.0.0'
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'rpm' && spec && spec.type === 'rpm'
  }

  async handle(request) {
    if (this.isProcessing(request)) {
      await super.handle(request)
      const spec = this.toSpec(request)
      this._createDocument(request, spec, request.document.registryData)
    }
    this.addLocalToolTasks(request)
    if (request.document.sourceInfo) {
      const sourceSpec = SourceSpec.fromObject(request.document.sourceInfo)
      this.linkAndQueue(request, 'rpm', sourceSpec.toEntitySpec())
    }
    return request
  }

  _createDocument(request, spec, registryData) {
    const { releaseDate, declaredLicense } = request.document
    request.document = merge(this.clone(request.document), { registryData, releaseDate, declaredLicense })
    const sourceInfo = this._discoverSource(spec, registryData)
    if (sourceInfo) request.document.sourceInfo = sourceInfo
  }

  _discoverSource(spec, registryData) {
    const result = SourceSpec.fromObject(spec)
    if (registryData !== undefined && registryData.rpm_sourcerpm != null) {
      // The source RPM field is `$name-[$epoch:]$version-$release.src.rpm`
      // The version and release fields can't contain hyphens, but the name can't.
      // Note that source RPM names may differ from binary RPMS, so spec.name can't
      // be used as the source name.
      var parts = registryData.rpm_sourcerpm.split("-")
      if (parts.length > 2) {
        // The last part is `$release.src.rpm`
        const release_and_arch = parts.pop()
        // The penultimate part is the version
        const version = parts.pop()
        // The rest can be rejoined to determine the name.
        result.name = parts.join("-")
        result.revision = version + "-" + release_and_arch
        if (result.revision.endsWith(".rpm")) {
          result.revision = result.revision.substring(0, result.revision.length - 4);
        }
        result.rpm_sourcerpm = null
        return result
      }
    }
    return null
  }
}
module.exports = (options, sourceFinder) => new RpmExtract(options, sourceFinder || sourceDiscovery)
