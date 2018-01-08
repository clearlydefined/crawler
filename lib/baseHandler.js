// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const tmp = require('tmp');
const semver = require('semver');
const EntitySpec = require('../lib/entitySpec');

tmp.setGracefulCleanup();
const tmpOptions = {
  unsafeCleanup: true,
  template: (process.platform === 'win32' ? 'c:/temp/' : '/tmp/') + 'cd-XXXXXX'
}

class BaseHandler {

  constructor(options) {
    this.options = options;
    this.logger = options.logger;
  }

  get tmpOptions() {
    const tmpBase = this.options.tempLocation || (process.platform === 'win32' ? 'c:/temp/' : '/tmp/');
    return {
      unsafeCleanup: true,
      template: tmpBase + 'cd-XXXXXX'
    };
  }

  shouldFetch(request) {
    return true;
  }

  canHandle(request) {
    return false;
  }

  shouldProcess(request) {
    return request.policy.shouldProcess(request, this.schemaVersion);
  }

  shouldTraverse(request) {
    return request.policy.shouldTraverse(request);
  }

  isProcessing(request) {
    return request.processMode === 'process';
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
    if (!Array.isArray(versions))
      return versions;
    if (versions.length === 0)
      return null;
    if (versions.length === 1)
      return versions[0];
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
    request.linkResource('self', this.getUrnFor(request, spec));
    request.linkSiblings(spec.toUrn());
  }

  getUrnFor(request, spec = null) {
    spec = spec || this.toSpec(request);
    const newSpec = Object.assign(Object.create(spec), spec, this.toolSpec);
    return newSpec.toUrn();
  }

  linkAndQueue(request, name, spec = null) {
    spec = spec || this.toSpec(request);
    request.linkResource(name, spec.toUrn());
    request.queue(name, spec.toUrl(), request.getNextPolicy(name));
  }

  linkAndQueueTool(request, name, tool = name) {
    const spec = this.toSpec(request);
    const url = spec.toUrl();
    spec.tool = tool;
    const urn = spec.toUrn();
    request.linkCollection(name, urn);
    request.queue(tool, url, request.getNextPolicy(name));
  }
}

module.exports = BaseHandler;