// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const fs = require('fs')
const path = require('path')
const Request = require('ghcrawler').request
const npm1k = require('npm1k')

class TopProcessor extends BaseHandler {
  get schemaVersion() {
    return 1
  }

  get toolSpec() {
    return { tool: 'toploader', toolVersion: this.schemaVersion }
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'top' && spec && ['npmjs', 'mavencentral'].includes(spec.provider)
  }

  handle(request) {
    const { document, spec } = super._process(request)
    this.addBasicToolLinks(request, spec)
    switch (spec.provider) {
      case 'npmjs':
        return this._processTopNpms(request)
      case 'mavencentral':
        return this._processTopMavenCenrals(request)
      default:
        throw new Error(`Unknown provider type for 'top' request: ${spec.provider}`)
    }
  }

  async _processTopNpms(request) {
    return new Promise((resolve, reject) => {
      npm1k((error, list) => {
        if (error) return reject(error)
        const { start, end } = request.document
        list = start || end ? list.slice(start || 0, end) : list
        const requests = list.map(p => {
          let [namespace, name] = p.split('/')
          if (!name) {
            name = namespace
            namespace = '-'
          }
          return new Request('package', `cd:/npm/npmjs/${namespace}/${name}`)
        })
        request.queueRequests(requests)
        resolve(request)
      })
    })
  }

  /* Example:
  {
    "type": "top",
    "url":"cd:/maven/mavencentral/-/-",
    "payload": {
      "body": {
        "start": 0,
        "end": 100
      }
    }
  }
  */
  async _processTopMavenCenrals(request) {
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
      return new Request('maven', `cd:/maven/mavencentral/${groupId}/${artifactId}`)
    })
    await request.queueRequests(requests)
  }
}

module.exports = options => new TopProcessor(options)
