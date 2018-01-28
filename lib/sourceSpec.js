// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const EntitySpec = require('./entitySpec');

class SourceSpec {

  static adopt(object) {
    if (object && object.__proto__ !== SourceSpec.prototype)
      object.__proto__ = SourceSpec.prototype;
    return object;
  }

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
      case 'github': {
        const segments = this.url.split('/');
        return new EntitySpec(this.type, this.provider, segments[3], segments[4], this.revision);
      }
      case 'maven-central':
        const segments = this.url.split('/');
        return new EntitySpec(this.type, this.provider, segments[0], segments[1], this.revision);
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