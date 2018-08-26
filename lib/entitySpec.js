// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

class EntitySpec {
  static fromUrl(url) {
    if (!url) return null
    const [full, type, provider, namespace, name, revision, toolSpec] = url.match(
      /.*:\/*([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/?([^/]+)?(\/tool\/.+)?/
    )
    const [blank, delimiter, toolName, toolVersion] = toolSpec ? toolSpec.split('/') : []
    return new EntitySpec(type, provider, namespace, name, revision, toolName, toolVersion)
  }

  static fromObject(spec) {
    if (!spec) return null
    if (spec.constructor === EntitySpec) return spec
    return new EntitySpec(
      spec.type,
      spec.provider,
      spec.namespace,
      spec.name,
      spec.revision,
      spec.tool,
      spec.toolVersion
    )
  }

  constructor(type, provider, namespace, name, revision = null, tool = null, toolVersion = null) {
    this.type = type.toLowerCase()
    this.provider = provider.toLowerCase()
    this.namespace = namespace === '-' ? null : namespace
    this.name = name
    this.revision = revision
    this.tool = tool && tool.toLowerCase()
    this.toolVersion = toolVersion && toolVersion.toLowerCase()
  }

  toUrn() {
    const revisionPart = this.revision ? `:revision:${this.revision}` : ''
    const toolVersionPart = this.toolVersion ? `:${this.toolVersion}` : ''
    const toolPart = this.tool ? `:tool:${this.tool}` : ''
    return `urn:${this.type}:${this.provider}:${this.namespace || '-'}:${
      this.name
    }${revisionPart}${toolPart}${toolVersionPart}`
  }

  toUrl() {
    return `cd:/${this.toUrlPath()}`
  }

  toUrlPath() {
    const revisionPart = this.revision ? `/${this.revision}` : ''
    const toolVersionPart = this.toolVersion ? `/${this.toolVersion}` : ''
    const toolPart = this.tool ? `/tool/${this.tool}` : ''
    return `${this.type}/${this.provider}/${this.namespace || '-'}/${
      this.name
    }${revisionPart}${toolPart}${toolVersionPart}`
  }
}

module.exports = EntitySpec
