// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

// Map building blocks
const self = {};

function neighbors() {
  return self;
}

const scancode = self;

// default ClearlyDefined tool
const cd = self;

const source = {
  _type: 'source',
  scancode,
  cd
}

const npm = {
  _type: 'npm',
  source,
  scancode,
  cd
};

const maven = {
  _type: 'maven',
  source,
  cd
};

const package = {
  _type: 'package',
  npm,
  maven
};

const entities = {
  self,
  neighbors,
  source,
  package,
  cd,
  scancode,
  npm,
  maven
};

module.exports = {
  default: entities
}