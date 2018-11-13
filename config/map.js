// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

// Map building blocks
const self = {}

function neighbors() {
  return self
}

const scancode = self
const fossology = self

// default ClearlyDefined tool
const clearlydefined = self

const source = {
  _type: 'source',
  clearlydefined,
  scancode,
  fossology
}

const npm = {
  _type: 'npm',
  source,
  clearlydefined,
  scancode,
  fossology
}

const crate = {
  _type: 'crate',
  source,
  clearlydefined,
  scancode,
  fossology
}

const maven = {
  _type: 'maven',
  source,
  clearlydefined
}

const nuget = {
  _type: 'nuget',
  source,
  clearlydefined
}

const pypi = {
  _type: 'pypi',
  source,
  scancode,
  clearlydefined
}

const gem = {
  _type: 'gem',
  source,
  scancode,
  clearlydefined
}

const _package = {
  _type: 'package',
  npm,
  crate,
  maven,
  nuget,
  pypi,
  gem
}

const component = {
  _type: 'component',
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
  npm,
  crate,
  maven,
  nuget,
  pypi,
  gem
}

module.exports = {
  default: entities
}
