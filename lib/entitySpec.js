// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const NAMESPACE = 0x4;
const NAME = 0x2;
const REVISION = 0x1;
const NONE = 0;

const toLowerCaseMap = {
  github: NAMESPACE | NAME,
  npmjs: NONE,
  mavencentral: NONE,
  mavencentralsource: NONE
}

function normalize(value, provider, property) {
  if (!value)
    return value;
  const mask = toLowerCaseMap[provider] || 0;
  return (mask & property) ? value.toLowerCase() : value;
}

class EntitySpec {
  static fromUrl(url) {
    const [full, type, provider, namespace, name, revision, toolSpec] = url.match(/.*:\/*([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/?([^/]+)?(\/tool\/.+)?/);
    const [blank, delimiter, toolName, toolVersion] = toolSpec ? toolSpec.split('/') : [];
    return new EntitySpec(type, provider, namespace, name, revision, toolName, toolVersion);
  }

  constructor(type, provider, namespace, name, revision = null, tool = null, toolVersion = null) {
    this.type = type.toLowerCase();
    this.provider = provider.toLowerCase();
    this.namespace = namespace === '-' ? null : normalize(namespace, this.provider, NAMESPACE);
    this.name = normalize(name, this.provider, NAME);
    this.revision = normalize(revision, this.provider, REVISION);
    this.tool = tool && tool.toLowerCase();
    this.toolVersion = toolVersion && toolVersion.toLowerCase();
  }

  toUrn() {
    const revisionPart = this.revision ? `:revision:${this.revision}` : '';
    const toolVersionPart = this.toolVersion ? `:${this.toolVersion}` : '';
    const toolPart = this.tool ? `:tool:${this.tool}` : '';
    return `urn:${this.type}:${this.provider}:${this.namespace || '-'}:${this.name}${revisionPart}${toolPart}${toolVersionPart}`
  }

  toUrl() {
    return `cd:/${this.toUrlPath()}`;
  }

  toUrlPath() {
    const revisionPart = this.revision ? `/${this.revision}` : '';
    const toolVersionPart = this.toolVersion ? `/${this.toolVersion}` : '';
    const toolPart = this.tool ? `/tool/${this.tool}` : '';
    return `${this.type}/${this.provider}/${this.namespace || '-'}/${this.name}${revisionPart}${toolPart}${toolVersionPart}`;
  }
}

module.exports = EntitySpec;