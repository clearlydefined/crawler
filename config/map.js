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

const package = {
  _type: 'package',
  npm,
  maven,
  nuget
}

const entities = {
  self,
  neighbors,
  source,
  package,
  clearlydefined,
  scancode,
  fossology,
  npm,
  maven,
  nuget
}

module.exports = {
  default: entities
}
