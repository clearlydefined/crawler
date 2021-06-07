// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractProcessor = require('./abstractProcessor')
const config = require('painless-config')
const DebianFetch = require('../fetch/debianFetch')
const fs = require('fs')
const ghrequestor = require('ghrequestor')
const linebyline = require('linebyline')
const path = require('path')
const Request = require('../../ghcrawler').request
const requestRetry = require('requestretry').defaults({ json: true, maxAttempts: 3, fullResponse: false })

class TopProcessor extends AbstractProcessor {
  canHandle(request) {
    const spec = this.toSpec(request)
    return (
      request.type === 'top' &&
      spec &&
      ['npmjs', 'cocoapods', 'cratesio', 'mavencentral', 'mavengoogle', 'nuget', 'github', 'gitlab', 'pypi', 'composer', 'debian'].includes(
        spec.provider
      )
    )
  }

  handle(request) {
    super.handle(request)
    const spec = this.toSpec(request)
    switch (spec.provider) {
      case 'npmjs':
        return this._processTopNpms(request)
      // case 'cocoapods':
      //   return this._processTopCocoapods(request)
      case 'cratesio':
        return this._processTopCrates(request)
      case 'mavencentral':
        return this._processTopMavenCentrals(request)
      case 'mavengoogle':
        return this._processTopMavenGoogle(request)
      case 'nuget':
        return this._processTopNuGets(request)
      case 'github':
        return this._processAllGitHubOrgRepos(request)
      // case 'pypi':
      //   return this._processTopPyPis(request)
      // case 'composer':
      //   return this._processTopPackagists(request)
      case 'debian':
        return this._processTopDebians(request)
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
      const packages = response.packages || []
      const requestsPage = packages.map(pkg => {
        let [namespace, name] = pkg.name.split('/')
        if (!name) {
          name = namespace
          namespace = '-'
        }
        return new Request('package', `cd:/npm/npmjs/${namespace}/${name}/${pkg.version}`)
      })
      await request.queueRequests(requestsPage)
      console.log(`Queued ${requestsPage.length} NPM packages. Offset: ${offset}`)
    }
    return request.markNoSave()
  }

  /* Example:
  {
    "type": "top",
    "url":"cd:/pod/cocoapods/-/name/0.2.0",
    "payload": {
      "body": {
        "start": 0,
        "end": 1000
      }
    }
  }
  */
  async _processTopCocoapods(request) {
    let { start, end } = request.document
    if (!start || start < 0) start = 0
    if (!end || end - start <= 0) end = start + 1000
    for (let offset = start; offset < end; offset += 100) {
      // const page = offset / 100 + 1
      // const response = await requestRetry.get(
      //   // `https://crates.io/api/v1/crates?page=${page}&per_page=100&sort=downloads`
      // )
      // const requestsPage = response.crates.map(
      //   x => new Request('package', `cd:/crate/cratesio/-/${x.name}/${x.max_version}`)
      // )
      // await request.queueRequests(requestsPage)
      // console.log(`Queued ${requestsPage.length} Crate packages. Offset: ${offset}`)
    }
  }

  /* Example:
  {
    "type": "top",
    "url":"cd:/crate/cratesio/-/insert/0.2.0",
    "payload": {
      "body": {
        "start": 0,
        "end": 1000
      }
    }
  }
  */
  async _processTopCrates(request) {
    let { start, end } = request.document
    if (!start || start < 0) start = 0
    if (!end || end - start <= 0) end = start + 1000
    for (let offset = start; offset < end; offset += 100) {
      const page = offset / 100 + 1
      const response = await requestRetry.get(
        `https://crates.io/api/v1/crates?page=${page}&per_page=100&sort=downloads`
      )
      const requestsPage = response.crates.map(
        x => new Request('package', `cd:/crate/cratesio/-/${x.name}/${x.max_version}`)
      )
      await request.queueRequests(requestsPage)
      console.log(`Queued ${requestsPage.length} Crate packages. Offset: ${offset}`)
    }
  }

  /* Example:
  {
    "type": "top",
    "url":"cd:/pypi/pypi/-/pip",
    "payload": {
      "body": {
        "start": 0,
        "end": 100
      }
    }
  }
  */
  // async _processTopPyPis(request) {
  //   let { start, end } = request.document
  //   const response = await requestRetry.get(
  //     `https://hugovk.github.io/top-pypi-packages/top-pypi-packages-30-days.min.json`,
  //     {}
  //   )
  //   const requests = []
  //   for (let offset = start; offset < end; offset++) {
  //     const packageName = response.rows[offset].project
  //     requests.push(new Request('package', `cd:/pypi/pypi/-/${packageName}`))
  //   }
  //   await request.queueRequests(requests)
  //   return request.markNoSave()
  // }

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

  async _processTopMavenGoogle(request) {
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
      return new Request('package', `cd:/maven/mavengoogle/${groupId}/${artifactId}`)
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
      console.log(`Queued ${requests.length} NuGet packages. Offset: ${offset}`)
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

  /* Example:
  {
    "type": "top",
    "url":"cd:/deb/debian/-/test",
    "payload": {
      "body": {
        "start": 0,
        "end": 100
      }
    }
  }
  */
  async _processTopDebians(request) {
    let { start, end } = request.document
    if (!start || start < 0) start = 0
    if (!end || end - start <= 0) end = start + 100
    const debianFetch = DebianFetch({
      logger: this.logger,
      cdFileLocation: config.get('FILE_STORE_LOCATION') || (process.platform === 'win32' ? 'c:/temp/cd' : '/tmp/cd')
    })
    await debianFetch._getPackageMapFile()
    const packagesCoordinates = await this._getDebianPackagesCoordinates(debianFetch)
    const slicedCoordinates = packagesCoordinates.slice(start, end)
    this.logger.info(
      `Debian top - coordinates: ${packagesCoordinates.length}, start: ${start}, end: ${end}, sliced: ${slicedCoordinates.length}`
    )
    const requests = slicedCoordinates.map(coordinate => new Request('package', coordinate))
    await request.queueRequests(requests)
    return request.markNoSave()
  }

  async _getDebianPackagesCoordinates(debianFetch) {
    return new Promise((resolve, reject) => {
      const coordinates = []
      const lineReader = linebyline(debianFetch.packageMapFileLocation)
      let entry = {}
      lineReader
        .on('line', line => {
          if (line === '') {
            const architecture = entry.Architecture
            const binary = entry.Binary
            const binaryVersion = entry['Binary-Version']
            if (architecture && binary && binaryVersion) {
              coordinates.push(`cd:/deb/debian/-/${binary}/${binaryVersion}_${architecture}`)
              entry = {}
            }
          } else {
            const [key, value] = line.split(': ')
            entry[key] = value
          }
        })
        .on('end', () => {
          return resolve(coordinates)
        })
        .on('error', error => reject(error))
    })
  }

  // TODO: Implement _processTopPackagists
}

module.exports = options => new TopProcessor(options)
