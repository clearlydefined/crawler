// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

class EntitySpec {
  static fromUrl(url) {
    const [full, type, provider, namespace, name, revision, tool] = url.match(/.*:\/*([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/?([^/]+)?(\/tool\/[^/]+)?$/);
    const toolSpec = tool ? tool.slice(6) : null;
    return new EntitySpec(type, provider, namespace === '-' ? null : namespace, name, revision, toolSpec);
  }

  constructor(type, provider, namespace, name, revision = null, tool = null) {
    this.type = type;
    this.provider = provider;
    this.namespace = namespace;
    this.name = name;
    this.revision = revision;
    this.tool = tool
  }

  toUrn() {
    const revisionPart = this.revision ? `:revision:${this.revision}` : '';
    const toolPart = this.tool ? `:tool:${this.tool}` : '';
    return `urn:${this.type}:${this.provider}:${this.namespace || '-'}:${this.name}${revisionPart}${toolPart}`
  }

  toUrl(base) {
    const revisionPart = this.revision ? `/${this.revision}` : '';
    const toolPart = this.tool ? `/tool/${this.tool}` : '';
    return `cd:/${this.type}/${this.provider}/${this.namespace || '-'}/${this.name}${revisionPart}${toolPart}`;
  }
}

module.exports = EntitySpec;