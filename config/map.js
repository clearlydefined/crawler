// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

// Map building blocks
const self = {}

function neighbors() {
  return self
}

const scancode = self
const fossology = self
const licensee = self

// default ClearlyDefined tool
const clearlydefined = self

const source = {
  _type: 'source',
  clearlydefined,
  licensee,
  scancode,
  fossology
}

const npm = {
  _type: 'npm',
  source,
  clearlydefined,
  licensee,
  scancode,
  fossology
}

const apk = {
  _type: 'apk',
  clearlydefined
}

const crate = {
  _type: 'crate',
  source,
  clearlydefined,
  licensee,
  scancode,
  fossology
}

const dpkg = {
  _type: 'dpkg',
  clearlydefined
}

const docker = {
  _type: 'docker',
  clearlydefined,
  apk,
  dpkg
}

const maven = {
  _type: 'maven',
  source,
  clearlydefined,
  licensee,
  scancode,
  fossology
}

const nuget = {
  _type: 'nuget',
  source,
  clearlydefined,
  licensee
}

const pod = {
  _type: 'pod',
  source,
  clearlydefined,
  licensee,
  scancode,
  fossology
}

const pypi = {
  _type: 'pypi',
  source,
  clearlydefined,
  licensee,
  scancode,
  fossology
}

const gem = {
  _type: 'gem',
  source,
  clearlydefined,
  licensee,
  scancode,
  fossology
}

const _package = {
  _type: 'package',
  npm,
  crate,
  maven,
  nuget,
  pod,
  pypi,
  gem
}

const component = {
  _type: 'component',
  docker,
  source,
  package: _package
}

const entities = {
  self,
  neighbors,
  component,
  source,
  package: _package,
  clearlydefined,
  scancode,
  fossology,
  licensee,
  npm,
  apk,
  crate,
  docker,
  dpkg,
  maven,
  nuget,
  pod,
  pypi,
  gem
}

module.exports = {
  default: entities
}
