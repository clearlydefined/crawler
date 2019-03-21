// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const EntitySpec = require('../../lib/entitySpec')
const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
const { merge } = require('lodash')

class DockerExtract extends AbstractClearlyDefinedProcessor {
  get toolVersion() {
    return '1.0.0'
  }

  get toolName() {
    return 'docker'
  }

  canHandle(request) {
    return request.type === 'docker'
  }

  async handle(request) {
    super.handle(request)
    const apk = request.document.apk
    const dpkg = request.document.dpkg
    request.document = merge(this.clone(request.document), { apk, dpkg })
    this._queueDpkgs(request)
    this._queueApks(request)
    return request
  }

  _queueDpkgs(request) {
    if (!request.document.dpkg) return
    const dpkgList = request.document.dpkg.split('\n')
    for (let dpkg of dpkgList) {
      let [name, revision] = dpkg.split('___')
      const spec = EntitySpec.fromObject({
        type: 'dpkg',
        provider: 'dpkg',
        name,
        revision
      })
      this.addEmbeddedComponent(request.document, spec)
      this.queueSpecific(spec)
    }
  }

  _queueApks(request) {
    if (!request.document.apk) return
    const apkNameList = request.document.apk.names.split('\n')
    const apkNameAndVersionList = request.document.apk.namesAndVersions.split('\n')
    for (let i = 0; i < apkNameList.length; i++) {
      let name = apkNameList[i]
      let revision = apkNameAndVersionList[i].replace(`${name}-`, '')
      const spec = EntitySpec.fromObject({
        type: 'apk',
        provider: 'apk',
        name,
        revision
      })
      this.addEmbeddedComponent(request.document, spec)
      this.queueSpecific(spec)
    }
  }
}

module.exports = options => new DockerExtract(options)
