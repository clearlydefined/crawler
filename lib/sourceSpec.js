// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const EntitySpec = require('./entitySpec')
const mavenFetch = require('../providers/fetch/mavencentralFetch')({})

class SourceSpec {
  static fromObject(spec) {
    if (!spec) return null
    if (spec.constructor === SourceSpec) return spec
    return new SourceSpec(spec.type, spec.provider, spec.namespace, spec.name, spec.revision, spec.url, spec.path)
  }

  constructor(type, provider, namespace, name, revision = null, url = null, path = null) {
    this.type = type.toLowerCase()
    this.provider = provider.toLowerCase()
    if (namespace) this.namespace = namespace
    this.name = name
    this.revision = revision
    this.url = url
    this.path = path
  }

  toEntitySpec() {
    return EntitySpec.fromObject(this)
  }

  toUrn() {
    return this.toEntitySpec().toUrn()
  }

  toUrl() {
    if (this.url) return this.url
    switch (this.provider) {
      case 'github':
        return `https://github.com/${this.namespace}/${this.name}.git`
      case 'mavencentral':
        return mavenFetch.buildUrl(this)
      default:
        return null
    }
  }
}

module.exports = SourceSpec
