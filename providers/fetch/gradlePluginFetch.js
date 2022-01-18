// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const MavenBasedFetch = require('./mavenBasedFetch')

class GradlePluginFetch extends MavenBasedFetch {

  constructor(options) {
    super({
      'gradleplugin': 'https://plugins.gradle.org/m2/'
    }, options)
  }

  _getArtifactExtensions(spec) {
    //TODO module files?
    return super._getArtifactExtensions(spec)
  }

}

module.exports = options => new GradlePluginFetch(options)