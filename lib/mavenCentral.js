// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const nodeRequest = require('request')
const fs = require('fs')

const sourceExtension = '-sources.jar'
const pomExtension = '.pom'
const providerMap = {
  mavencentral: 'https://search.maven.org/remotecontent?filepath='
}

function fetchPom(spec, destination) {
  return _fetchFromMavenCentral(buildUrl(spec, pomExtension), destination)
}

function fetchSourcesJar(spec, destination) {
  return _fetchFromMavenCentral(buildUrl(spec, sourceExtension), destination)
}

function buildUrl(spec, extension) {
  const fullName = `${spec.namespace}/${spec.name}`.replace(/\./g, '/')
  return `${providerMap[spec.provider]}${fullName}/${spec.revision}/${spec.name}-${spec.revision}${extension}`
}

function _fetchFromMavenCentral(url, destination) {
  return new Promise((resolve, reject) => {
    nodeRequest
      .get(url, (error, response) => {
        if (error) return reject(error)
        if (response.statusCode === 404) resolve(response.statusCode)
        if (response.statusCode !== 200) reject(new Error(`${response.statusCode} ${response.statusMessage}`))
      })
      .pipe(fs.createWriteStream(destination).on('finish', () => resolve(null)))
  })
}

module.exports.fetchPom = fetchPom
module.exports.fetchSourcesJar = fetchSourcesJar
module.exports.buildUrl = buildUrl
module.exports.sourceExtension = sourceExtension
module.exports.pomExtension = pomExtension
