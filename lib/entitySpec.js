// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

class EntitySpec {
  static fromUrl(url) {
    const [full, type, provider, namespace, name, revision, toolSpec] = url.match(/.*:\/*([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/?([^/]+)?(\/tool\/.+)?/);
    const [blank, delimiter, toolName, toolVersion] = toolSpec ? toolSpec.split('/') : [];
    return new EntitySpec(type, provider, namespace, name, revision, toolName, toolVersion);
  }

  constructor(type, provider, namespace, name, revision = null, tool = null, toolVersion = null) {
    this.type = type;
    this.provider = provider;
    this.namespace = namespace === '-' ? null : namespace;
    this.name = name;
    this.revision = revision;
    this.tool = tool
    this.toolVersion = toolVersion
  }

  toUrn() {
    const revisionPart = this.revision ? `:revision:${this.revision}` : '';
    const toolVersionPart = this.toolVersion ? `:${this.toolVersion}` : '';
    const toolPart = this.tool ? `:tool:${this.tool}` : '';
    return `urn:${this.type}:${this.provider}:${this.namespace || '-'}:${this.name}${revisionPart}${toolPart}${toolVersionPart}`
  }

  toUrl(base) {
    const revisionPart = this.revision ? `/${this.revision}` : '';
    const toolVersionPart = this.toolVersion ? `/${this.toolVersion}` : '';
    const toolPart = this.tool ? `/tool/${this.tool}` : '';
    return `cd:/${this.type}/${this.provider}/${this.namespace || '-'}/${this.name}${revisionPart}${toolPart}${toolVersionPart}`;
  }
}

module.exports = EntitySpec;