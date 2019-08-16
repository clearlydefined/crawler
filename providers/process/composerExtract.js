// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractClearlyDefinedProcessor = require('./abstractClearlyDefinedProcessor')
// const fs = require('fs')
// const path = require('path')
const sourceDiscovery = require('../../lib/sourceDiscovery')
// const SourceSpec = require('../../lib/sourceSpec')
// const { get, isArray, merge } = require('lodash')

class ComposerExtract extends AbstractClearlyDefinedProcessor {
  constructor(options, sourceFinder) {
    super(options)
    this.sourceFinder = sourceFinder
  }

  get toolVersion() {
    return '1.1.4'
  }

  canHandle(request) {
    const spec = this.toSpec(request)
    return request.type === 'composer' && spec && spec.type === 'composer'
  }
}

module.exports = (options, sourceFinder) => new ComposerExtract(options, sourceFinder || sourceDiscovery)
