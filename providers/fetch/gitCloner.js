// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const { exec } = require('child_process')
const SourceSpec = require('../../lib/sourceSpec')
const { clone } = require('lodash')

class GitCloner extends BaseHandler {
  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type !== 'source' && spec && spec.type === 'git'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    const sourceSpec = SourceSpec.fromObject(spec)
    const options = { version: sourceSpec.revision }
    const dir = this._createTempDir(request)

    const repoSize = await this._cloneRepo(sourceSpec.toUrl(), dir.name, spec.name, options.version)
    request.addMeta({ gitSize: repoSize })
    const releaseDate = await this._getDate(dir.name, spec.name)

    request.contentOrigin = 'origin'
    request.document = this._createDocument(dir.name + '/' + spec.name, repoSize, releaseDate, options.version)
    if (spec.provider === 'github') {
      request.casedSpec = clone(spec)
      request.casedSpec.namespace = spec.namespace.toLowerCase()
      request.casedSpec.name = spec.name.toLowerCase()
    }
    return request
  }

  _createDocument(location, size, releaseDate, commit) {
    // Create a simple document that records the location and the size of the repo that was fetched
    return { location, size, releaseDate, hashes: { gitSha: commit } }
  }

  _cloneRepo(sourceUrl, dirName, specName, commit) {
    return new Promise((resolve, reject) => {
      exec(
        `cd ${dirName} && git clone ${sourceUrl} --quiet && cd ${specName} && git reset --hard ${commit} --quiet && git count-objects -v`,
        (error, stdout) => (error ? reject(error) : resolve(this._getRepoSize(stdout)))
      )
    })
  }

  _getDate(dirName, specName) {
    return new Promise((resolve, reject) => {
      exec(`cd ${dirName}/${specName} && git show -s --format=%ci`, (error, stdout) =>
        error ? reject(error) : resolve(new Date(stdout.trim()))
      )
    })
  }

  _getRepoSize(gitCountObjectsResult = '') {
    // ...\nsize-pack: 3\n... (in KB)
    return Number(gitCountObjectsResult.match('size-pack: (.*)\n')[1])
  }
}

module.exports = options => new GitCloner(options)
