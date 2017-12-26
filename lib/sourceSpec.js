// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const EntitySpec = require('./entitySpec');

class SourceSpec {

  constructor(type, provider, url, revision = null, path = null) {
    this.type = type;
    this.provider = provider;
    this.url = url;
    this.revision = revision;
    this.path = path
  }

  toEntitySpec() {
    // TODO what to do about the <path> part?
    switch (this.provider) {
      case 'github':
        return new EntitySpec(this.type, this.provider, this.github.owner, this.github.name, this.revision);
      default:
        return null;
    }
  }

  toUrn() {
    // TODO what to do about the <path> part?
    const revisionPart = this.revision ? `:revision:${this.revision}` : '';
    switch (this.provider) {
      case 'github':
        return `urn:${this.type}:${this.provider}:${this.github.owner}:${this.github.name}${revisionPart}`
      default:
        return null;
    }
  }
}

module.exports = SourceSpec;