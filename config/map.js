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
const reuse = self

// default ClearlyDefined tool
const clearlydefined = self

const source = {
  _type: 'source',
  clearlydefined,
  licensee,
  reuse,
  scancode,
  fossology
}

const npm = {
  _type: 'npm',
  source,
  clearlydefined,
  licensee,
  reuse,
  scancode,
  fossology
}

const crate = {
  _type: 'crate',
  source,
  clearlydefined,
  licensee,
  reuse,
  scancode,
  fossology
}

const deb = {
  _type: 'deb',
  source,
  clearlydefined,
  licensee,
  reuse,
  scancode,
  fossology
}

const go = {
  _type: 'go',
  source,
  clearlydefined,
  licensee,
  scancode,
  fossology
}

const maven = {
  _type: 'maven',
  source,
  clearlydefined,
  licensee,
  reuse,
  scancode,
  fossology
}

const nuget = {
  _type: 'nuget',
  source,
  clearlydefined,
  licensee,
  scancode,
  reuse
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
  reuse,
  scancode,
  fossology
}

const composer = {
  _type: 'composer',
  source,
  clearlydefined,
  licensee,
  reuse,
  scancode,
  fossology
}

const gem = {
  _type: 'gem',
  source,
  clearlydefined,
  licensee,
  reuse,
  scancode,
  fossology
}

const _package = {
  _type: 'package',
  npm,
  crate,
  deb,
  go,
  maven,
  nuget,
  pod,
  pypi,
  composer,
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
  licensee,
  reuse,
  npm,
  crate,
  deb,
  go,
  maven,
  nuget,
  composer,
  pod,
  pypi,
  gem
}

module.exports = {
  default: entities
}
