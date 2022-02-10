// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const MavenBasedFetch = require('./mavenBasedFetch')

class GradlePluginFetch extends MavenBasedFetch {

  constructor(options) {
    super({
      'gradleplugin': 'https://plugins.gradle.org/m2/'
    }, options)
  }

  async _getPoms(spec, result = []) {
    //TODO: Newer plugins have plugin_id-version.module files. Include?
    //See https://docs.gradle.org/current/userguide/publishing_gradle_module_metadata.html
    return super._getPoms(spec, result)
  }

}

module.exports = options => new GradlePluginFetch(options)