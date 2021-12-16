// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const MavenBasedFetch = require('./mavenBasedFetch')

class MavenGoogleFetch extends MavenBasedFetch {
  constructor(options) {
    super(options, {
      mavengoogle: 'https://dl.google.com/android/maven2/'
    })
  }
  //The format for source url is: https://dl.google.com/android/maven2/groudId1/groupdId2/artifactId/revision/artifactId-revision-sources.jar
  // E.g.: https://maven.google.com/web/index.html#androidx.browser:browser:1.3.0
  // where - groupId      = androidx.browser
  //       - artifactId   = browser
  //       - revision     = 1.3.0
  // Becomes https://dl.google.com/android/maven2/androidx/browser/browser/1.3.0/browser-1.3.0-sources.jar
  _buildUrl(spec, extension) {
    return super._buildUrl(spec, extension)
  }
}

module.exports = options => new MavenGoogleFetch(options)
