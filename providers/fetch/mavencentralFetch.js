// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const MavenBasedFetch = require('./mavenBasedFetch')
const { get } = require('lodash')

class MavenCentralFetch extends MavenBasedFetch {

  constructor(options) {
    super(options, {
      mavencentral: 'https://search.maven.org/remotecontent?filepath='
    })
  }
  // query maven to get the latest version if we don't already have that.
  // Example: https://search.maven.org/solrsearch/select?q=g:%22org.eclipse%22+AND+a:%22swt%22+AND+v:%223.3.0-v3346%22&rows=1&wt=json
  async _getLatestVersion(spec) {
    const url = `https://search.maven.org/solrsearch/select?q=g:"${spec.namespace}"+AND+a:"${spec.name}"&rows=1&wt=json`
    const response = await this._requestPromise({ url, json: true })
    return get(response, 'response.docs[0].latestVersion')
  }

  async _getReleaseDate(dirName, spec) {
    const specForQuery = `g:"${spec.namespace}"+AND+a:"${spec.name}"+AND+v:"${spec.revision}"`
    const url = `https://search.maven.org/solrsearch/select?q=${specForQuery}&rows=1&wt=json`
    const response = await this._requestPromise({ url, json: true })
    const timestamp = get(response, 'response.docs[0].timestamp')
    if (timestamp) return new Date(timestamp).toISOString()

    return await super._getReleaseDate(dirName, spec)
  }
}

module.exports = options => new MavenCentralFetch(options)
