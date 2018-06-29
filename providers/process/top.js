// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const fs = require('fs')
const ghrequestor = require('ghrequestor')
const path = require('path')
const Request = require('ghcrawler').request
const requestRetry = require('requestretry').defaults({ json: true, maxAttempts: 3, fullResponse: false })

class TopProcessor extends BaseHandler {
  get schemaVersion() {
    return 1
  }

  get toolSpec() {
    return { tool: 'toploader', toolVersion: this.schemaVersion }
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'top' && spec && ['npmjs', 'mavencentral', 'nuget', 'github'].includes(spec.provider)
  }

  handle(request) {
    const { document, spec } = super._process(request)
    this.addBasicToolLinks(request, spec)
    switch (spec.provider) {
      case 'npmjs':
        return this._processTopNpms(request)
      case 'mavencentral':
        return this._processTopMavenCentrals(request)
      case 'nuget':
        return this._processTopNuGets(request)
      case 'github':
        return this._processAllGitHubOrgRepos(request)
      default:
        throw new Error(`Unknown provider type for 'top' request: ${spec.provider}`)
    }
  }

  /* Example:
  {
    "type": "top",
    "url":"cd:/npm/npmjs/-/redie/0.3.0",
    "payload": {
      "body": {
        "start": 0,
        "end": 100
      }
    }
  }
  */
  async _processTopNpms(request) {
    let { start, end } = request.document
    if (!start || start < 0) start = 0
    if (!end || end - start <= 0) end = start + 1000
    const initialOffset = Math.floor(start / 36) * 36
    for (let offset = initialOffset; offset < end; offset += 36) {
      const response = await requestRetry.get(`https://www.npmjs.com/browse/depended?offset=${offset}`, {
        headers: { 'x-spiferack': 1 }
      })
      const requestsPage = response.packages.map(pkg => {
        let [namespace, name] = pkg.name.split('/')
        if (!name) {
          name = namespace
          namespace = '-'
        }
        return new Request('package', `cd:/npm/npmjs/${namespace}/${name}/${pkg.version}`)
      })
      await request.queueRequests(requestsPage)
    }
    return request.markNoSave()
  }

  /* Example:
  {
    "type": "top",
    "url":"cd:/maven/mavencentral/junit/junit",
    "payload": {
      "body": {
        "start": 0,
        "end": 100
      }
    }
  }
  */
  async _processTopMavenCentrals(request) {
    const contents = fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'mvn1.5k.csv'))
    const fileLines = contents.toString().split('\n')
    let { start, end } = request.document
    start = start && start >= 0 ? ++start : 1 // Exclude header from CSV file
    end = end && end > 0 ? ++end : fileLines.length
    const lines = fileLines.slice(start, end)
    const requests = lines.map(line => {
      let [, groupId, artifactId] = line.split(',')
      groupId = groupId.substring(1, groupId.length - 1) // Remove quotes
      artifactId = artifactId.substring(1, artifactId.length - 1)
      return new Request('package', `cd:/maven/mavencentral/${groupId}/${artifactId}`)
    })
    await request.queueRequests(requests)
    return request.markNoSave()
  }

  /* Example:
  {
    "type": "top",
    "url":"cd:/nuget/nuget/-/moq",
    "payload": {
      "body": {
        "start": 0,
        "end": 100
      }
    }
  }
  */
  async _processTopNuGets(request) {
    // https://docs.microsoft.com/en-us/nuget/api/search-query-service-resource
    // Example: https://api-v2v3search-0.nuget.org/query?prerelease=false&skip=5&take=10
    const pageSize = 20
    let { start, end } = request.document
    if (!start || start < 0) start = 0
    if (!end || end - start <= 0) end = start + 1000
    for (let offset = start; offset < end; offset += pageSize) {
      const topComponents = await requestRetry.get(
        `https://api-v2v3search-0.nuget.org/query?prerelease=false&skip=${offset}&take=${pageSize}`
      )
      const requests = topComponents.data.map(component => {
        return new Request('package', `cd:/nuget/nuget/-/${component.id}`)
      })
      await request.queueRequests(requests)
    }
    return request.markNoSave()
  }

  /* Example:
  {
    "type": "top",
    "url":"cd:/git/github/contosodev/test",
    "payload": {
    }
  }
  */
  async _processAllGitHubOrgRepos(request) {
    const { namespace } = this.toSpec(request)
    const headers = {
      'User-Agent': 'clearlydefined/scanning'
    }
    const token = this.options.githubToken
    if (token) headers.Authorization = 'token ' + token
    const repos = await ghrequestor.getAll(`https://api.github.com/orgs/${namespace}/repos`, {
      headers,
      tokenLowerBound: 10
    })
    const requests = []
    for (let i = 0; i < repos.length; i++) {
      const commits = await requestRetry.get(`https://api.github.com/repos/${namespace}/${repos[i].name}/commits`, {
        headers
      })
      if (commits.length > 0) {
        requests.push(new Request('source', `cd:/git/github/${namespace}/${repos[i].name}/${commits[0].sha}`))
      }
    }
    await request.queueRequests(requests)
    return request.markNoSave()
  }
}

module.exports = options => new TopProcessor(options)
