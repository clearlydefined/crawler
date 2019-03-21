// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractFetch = require('./abstractFetch')
const { exec } = require('child_process')

class DockerFetch extends AbstractFetch {
  canHandle(request) {
    const spec = this.toSpec(request)
    return spec && spec.type === 'docker'
  }

  async handle(request) {
    const spec = this.toSpec(request)
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
    await new Promise((resolve, reject) => {
      exec(`docker pull ${imageName}`, error => {
        if (error) return reject(error)
        resolve()
      })
    })
    return new Promise((resolve, reject) => {
      exec(`docker inspect --format='{{.RepoDigests}}' ${imageName}`, (error, stdout) => {
        if (error) return reject(error)
        resolve(stdout.match(/.*@sha256:([a-z0-9]+)\]/)[1])
      })
    })
  }

  async _getApk(spec) {
    // the name and versions are separated by hyphens
    // but the names and the versions can also have hyphens
    // dump the names and then dump name-versions so we can detect
    const imageName = this._getHashImageName(spec)
    const names = await new Promise((resolve, reject) => {
      exec(`docker run --entrypoint "apk" ${imageName} info`, (error, stdout) => {
        if (error) {
          // TODO: setup to handle this error
          if (error === 'SPECIFIC KNOWN ERROR') return resolve(null)
          //return reject(error)
          return resolve(null)
        }
        resolve(stdout.trim())
      })
    })
    if (!names) return null
    const namesAndVersions = await new Promise((resolve, reject) => {
      exec(`docker run --entrypoint "apk" ${imageName} info -v`, (error, stdout) => {
        if (error) return reject(error)
        resolve(stdout.trim())
      })
    })
    return { names, namesAndVersions }
  }

  _getDpkg(spec) {
    return new Promise((resolve, reject) => {
      exec(
        `docker run --entrypoint "dpkg" ${spec.namespace ? `${spec.namespace}/${spec.name}` : spec.name}@sha256:${
          spec.revision
        } --list | awk 'NR>5 {print $2 "___" $3}'`,
        (error, stdout) => {
          if (error) {
            // TODO: setup to handle this error
            if (error === 'SPECIFIC KNOWN ERROR') return resolve(null)
            //return reject(error)
            return resolve(null)
          }
          resolve(stdout.trim())
        }
      )
    })
  }

  _getLocation() {
    return new Promise(resolve => {
      // TODO: mount the image to a directory so we can hash and harvest files etc
      resolve('')
    })
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
