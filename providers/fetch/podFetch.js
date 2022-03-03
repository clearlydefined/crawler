// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { clone, get } = require('lodash')
const AbstractFetch = require('./abstractFetch')
const request = require('request-promise-native')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { exec } = require('child_process')
const requestRetry = require('requestretry').defaults({ maxAttempts: 3, fullResponse: true })
const FetchResult = require('../../lib/fetchResult')

const services = {
  trunk: 'https://trunk.cocoapods.org/api/v1',
  specs: 'https://raw.githubusercontent.com/CocoaPods/Specs/master'
}

class PodFetch extends AbstractFetch {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.provider === 'cocoapods'
  }

  async handle(request) {
    const spec = this.toSpec(request)

    // Ensure we have a spec revision, we can't get the registry data without one
    const version = await this._getVersion(spec)
    if (!version || !version.name) return request.markSkip('Missing  ')
    spec.revision = version.name

    // Get the registry data/manifest
    const registryData = await this._getRegistryData(spec)
    if (!registryData) return request.markSkip('Missing  ')

    // Download the package/source
    const dir = this.createTempDir(request)
    const location = await this._getPackage(dir, registryData)
    if (!location) return request.markSkip('Missing  ')

    const fetchResult = new FetchResult(spec.toUrl())
    fetchResult.document = {
      location: location,
      registryData: registryData,
      releaseDate: version.created_at
    }

    if (registryData.name) {
      fetchResult.casedSpec = clone(spec)
      fetchResult.casedSpec.name = registryData.name
    }
    request.fetchResult = fetchResult.adoptCleanup(dir, request)
    return request
  }

  async _getRegistryData(spec) {
    let registryData
    try {
      registryData = await request({
        url: `${services.specs}/Specs/${this._masterRepoPathFragment(spec, [1, 1, 1])}/${spec.name}.podspec.json`,
        headers: {
          Authorization: this.options.githubToken ? `token ${this.options.githubToken}` : ''
        },
        json: true
      })
    } catch (exception) {
      if (exception.statusCode !== 404) throw exception
      return null
    }

    return registryData
  }

  async _getPackage(dir, podspec) {
    const httpSource = get(podspec, 'source.http')
    const gitSource = get(podspec, 'source.git')
    if (httpSource) {
      return await this._getSourceArchive(dir, httpSource, podspec)
    } else if (gitSource) {
      return await this._getGitRepo(dir, gitSource, podspec)
    } else {
      // Unsupported source (e.g. SVN and Mercurial)
      // https://guides.cocoapods.org/syntax/podspec.html#source
      return null
    }
  }

  async _getSourceArchive(dir, url, podspec) {
    const archive = path.join(dir.name, `${podspec.name}-${podspec.version}.archive`)
    const output = path.join(dir.name, `${podspec.name}-${podspec.version}`)
    return new Promise((resolve, reject) => {
      request({ url: url, json: false, encoding: null }).pipe(
        fs
          .createWriteStream(archive)
          .on('finish', async () => {
            await this.decompress(archive, output)
            resolve(output)
          })
          .on('error', reject)
      )
    })
  }

  async _getGitRepo(dir, repo, podspec) {
    const rev = get(podspec, 'source.commit') || get(podspec, 'source.tag')

    if (!rev) {
      // CocoaPods support source.branch too
      return null
    }

    let cloneOptions = ['--quiet']
    if (get(podspec, 'source.submodules', false)) {
      cloneOptions.push('--recursive')
    }

    const outputDirName = `${podspec.name}-${podspec.version}`
    const output = path.join(dir.name, outputDirName)

    const cloneCommands = [
      `git -C "${dir.name}" clone ${cloneOptions.join(' ')} ${repo} "${outputDirName}"`,
      `git -C "${output}" reset --quiet --hard ${rev}`
    ]

    return new Promise((resolve, reject) => {
      exec(cloneCommands.join(' && '), error => (error ? reject(error) : resolve(output)))
    })
  }

  async _getVersion(spec) {
    // Example: https://trunk.cocoapods.org/api/v1/pods/SwiftLCS
    const { body, statusCode } = await requestRetry.get(`${services.trunk}/pods/${spec.name}`, {
      json: true
    })

    if (statusCode === 200 && body.versions) {
      const versions = body.versions

      if (spec.revision) {
        return versions.find(version => version.name === spec.revision)
      } else {
        return versions[versions.length - 1] // the versions are already sorted
      }
    } else {
      return null
    }
  }

  _masterRepoPathFragment(spec, prefixLengths) {
    // Ported from: https://www.rubydoc.info/gems/cocoapods-core/Pod%2FSource%2FMetadata:path_fragment
    let prefixes
    if (prefixLengths.length > 0) {
      let hashedName = crypto
        .createHash('md5')
        .update(spec.name)
        .digest('hex')
      prefixes = prefixLengths.map(function (length) {
        const prefix = hashedName.slice(0, length)
        hashedName = hashedName.substring(length)
        return prefix
      })
    } else {
      prefixes = []
    }

    prefixes.push(spec.name)

    if (spec.revision) {
      prefixes.push(spec.revision)
    }

    return prefixes.join('/')
  }
}

module.exports = options => new PodFetch(options)
