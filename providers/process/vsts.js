// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const BaseHandler = require('../../lib/baseHandler')
const EntitySpec = require('../../lib/entitySpec')
const fs = require('fs')
const nodeRequest = require('request')
const path = require('path')
const { promisify } = require('util')
const { get } = require('lodash')

let _toolVersion

class VstsProcessor extends BaseHandler {
  get schemaVersion() {
    return _toolVersion
  }

  get toolSpec() {
    return { tool: 'scancode', toolVersion: this.schemaVersion }
  }

  get authToken() {
    return 'Basic ' + Buffer.from(this.options.apiToken + ':', 'utf8').toString('base64')
  }

  canHandle(request) {
    _toolVersion = (request.document && request.document.toolVersion) || '2.9.1'
    return request.type === 'ingest-vsts'
  }

  async handle(request) {
    const { document } = super._process(request)
    this.logger.info(`Processing ${request.toString()}`)

    // Get the build output and unzip
    let file = document.file
    if (!file) {
      // if no file name is given then get the output from the build system
      file = this._createTempFile(request).name
      await this._getBuildOutput(document.buildOutput, file)
    }
    const dir = this._createTempDir(request)
    await this.unzip(file, dir.name)
    const folders = await promisify(fs.readdir)(dir.name)
    if (folders.length !== 1) throw new Error('Malformed build output zip. Too many root folders')
    const root = path.join(dir.name, folders[0])

    // Get the original request info from the output and update this request to match
    const originalRequest = JSON.parse((await promisify(fs.readFile)(path.join(root, 'request.json'))).toString())
    if (request.url !== originalRequest.url) {
      request.url = originalRequest.url
      document._metadata.url = originalRequest.url
      document._metadata.type = originalRequest.type
    }
    document._metadata.releaseDate = get(originalRequest, 'context.releaseDate')

    // construct the right urn and link
    const spec = EntitySpec.fromUrl(request.url)
    spec.tool = originalRequest.type
    spec.toolVersion = document.toolVersion
    this.addBasicToolLinks(request, spec)

    // Add the output content to the document
    const scancodeFilePath = path.join(root, 'scancode.json')
    try {
      await promisify(fs.access)(scancodeFilePath)
      document._metadata.contentLocation = scancodeFilePath
      document._metadata.contentType = 'application/json'
      return request
    } catch (error) {
      const buildError = (await promisify(fs.readFile)(path.join(root, 'error.json'))).toString()
      throw new Error(JSON.parse(buildError).error)
    }
  }

  _getBuildOutput(outputUrl, destination) {
    return new Promise((resolve, reject) => {
      nodeRequest
        .get(outputUrl, { headers: { Authorization: this.authToken } }, (error, response) => {
          if (error) return reject(error)
          if (response.statusCode !== 200) reject(new Error(`${response.statusCode} ${response.statusMessage}`))
        })
        .pipe(fs.createWriteStream(destination).on('finish', () => resolve(null)))
    })
  }
}

module.exports = options => new VstsProcessor(options)
