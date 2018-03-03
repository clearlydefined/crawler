// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

// Map building blocks
const self = {}

function neighbors() {
  return self
}

const scancode = self

// default ClearlyDefined tool
const clearlydefined = self

const source = {
  _type: 'source',
  scancode,
  clearlydefined
}

const npm = {
  _type: 'npm',
  source,
  scancode,
  clearlydefined
}

const maven = {
  _type: 'maven',
  source,
  clearlydefined
}

const package = {
  _type: 'package',
  npm,
  maven
}

const entities = {
  self,
  neighbors,
  source,
  package,
  clearlydefined,
  scancode,
  npm,
  maven
}

module.exports = {
  default: entities
}
