// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { promisify } = require('util')
const parseXml = promisify(require('xml2js').parseString)
const { get } = require('lodash')
const MavenBasedFetch = require('./mavenBasedFetch')

class GradlePluginFetch extends MavenBasedFetch {

  constructor(options) {
    super(options, {
      'gradle-plugins': 'https://plugins.gradle.org/m2/'
    })
  }

  async _getLatestVersion(spec) {
    //Use Maven repository meta data model to get the latest version
    //https://maven.apache.org/ref/3.2.5/maven-repository-metadata/repository-metadata.html#class_versioning
    const url = `${this._buildBaseUrl(spec)}/maven-metadata.xml`
    const response = await this._requestPromise({ url, json: false })
    const meta = await parseXml(response)
    return get(meta, 'metadata.versioning[0].release[0]')
  }

  _getArtifactExtensions(spec) {
    //TODO module files?
    return super._getArtifactExtensions(spec)
  }

}

module.exports = options => new GradlePluginFetch(options)