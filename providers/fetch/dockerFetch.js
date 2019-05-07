// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const { promisify } = require('util')
const execFile = promisify(require('child_process').execFile)

class DockerFetch extends AbstractFetch {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.type === 'docker'
  }

  async handle(request) {
    const spec = this.toSpec(request)
    if (this.options.disabled) return this.queueSpecific(request, spec)
    spec.revision = await this._getRevision(spec)
    request.url = spec.toUrl()
    const location = await this._getLocation(spec)
    const apk = await this._getApk(spec)
    const dpkg = await this._getDpkg(spec)
    if (!apk && !dpkg) return this.markSkip(request)
    request.document = { apk, dpkg, location }
    request.contentOrigin = 'origin'
    return request
  }

  async _getRevision(spec) {
    // TODO: handle bad tags/names etc -> return null and then markSkip
    const imageName = this._getTagImageName(spec)
    await execFile('docker', ['pull', imageName])
    // eslint-disable-next-line quotes
    const { stdout } = await execFile('docker', ['inspect', "--format='{{.RepoDigests}}'", imageName])
    return stdout.match(/.*@sha256:([a-z0-9]+)\]/)[1]
  }

  async _getApk(spec) {
    // the name and versions are separated by hyphens
    // but the names and the versions can also have hyphens
    // dump the names and then dump name-versions so we can detect
    const imageName = this._getHashImageName(spec)
    const names = await this._runDockerCommand(imageName, 'apk', ['info'])
    if (!names) return null
    const namesAndVersions = await this._runDockerCommand(imageName, 'apk', ['info', '-v'])
    const alpineVersion = await this._runDockerCommand(imageName, 'cat', ['/etc/alpine-release'])
    return { names, namesAndVersions, version: `v${alpineVersion}` }
  }

  _getDpkg(spec) {
    const imageName = this._getHashImageName(spec)
    return this._runDockerCommand(imageName, 'dpkg', ['--list', '|', 'awk \'NR>5 {print $2 "___" $3}\''])
  }

  _getLocation() {
    return new Promise(resolve => {
      // TODO: mount the image to a directory so we can hash and harvest files etc
      resolve('')
    })
  }

  async _runDockerCommand(imageName, command, commandArgs) {
    try {
      const { stdout } = await execFile('docker', ['run', '--entrypoint', command, imageName, ...commandArgs])
      return stdout.trim()
    } catch (error) {
      if (error.stderr.indexOf('executable file not found') > -1) return null
      throw error
    }
  }

  _getTagImageName(spec) {
    return spec.namespace ? `${spec.namespace}/${spec.name}:${spec.revision}` : `${spec.name}:${spec.revision}`
  }

  _getHashImageName(spec) {
    return spec.namespace
      ? `${spec.namespace}/${spec.name}@sha256:${spec.revision}`
      : `${spec.name}@sha256:${spec.revision}`
  }
}

module.exports = options => new DockerFetch(options)
