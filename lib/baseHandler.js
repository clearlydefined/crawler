// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const tmp = require('tmp');
const semver = require('semver');
const EntitySpec = require('../lib/entitySpec');

const tmpOptions = { unsafeCleanup: true, prefix: 'cd-' };

class BaseHandler {

  constructor(options) {
    this.options = options;
    this.logger = options.logger;
  }

  _process(request) {
    request.document._metadata.version = this.schemaVersion || 1;
    return { document: request.document, spec: this.toSpec(request) };
  }

  _createTempFile(request) {
    const result = tmp.fileSync(tmpOptions);
    request.trackCleanup(result.removeCallback);
    return result;
  }

  _createTempDir(request) {
    const result = tmp.dirSync(tmpOptions);
    request.trackCleanup(result.removeCallback);
    return result;
  }

  toSpec(request) {
    return EntitySpec.fromUrl(request.url);
  }

  getLatestVersion(versions) {
    if (!Array.isArray(versions) || versions.length === 0)
      return;
    return versions
      .filter(v => !this.isPreReleaseVersion(v))
      .reduce((max, current) => semver.gt(current, max) ? current : max, versions[0]);
  }

  isPreReleaseVersion(version) {
    return semver.prerelease(version) !== null;
  }

  link(request, name, spec) {
    request.linkResource(name, spec.toUrn());
  }

  addSelfLink(request, urn = null) {
    urn = urn || this.toSpec(request).toUrn();
    request.linkResource('self', urn);
  }

  addBasicToolLinks(request, spec) {
    request.linkResource('self', this._getToolUrn(spec));
    request.linkSiblings(spec.toUrn());
  }

  _getToolUrn(spec) {
    const newSpec = Object.assign(Object.create(spec), spec, this.toolSpec);
    return newSpec.toUrn();
  }

  linkAndQueue(request, name, spec) {
    request.linkResource(name, spec.toUrn());
    request.queue(spec.type, spec.toUrl(), request.getNextPolicy(name));
  }

  linkAndQueueTool(request, name, tool) {
    const spec = this.toSpec(request);
    spec.tool = tool;
    request.linkCollection(name, spec.toUrn());
    request.queue(spec.type, spec.toUrl(), request.getNextPolicy(name));
  }
}

module.exports = BaseHandler;