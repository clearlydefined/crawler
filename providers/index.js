// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const HashedContentFactory = require('./store/hashedContentFactory')
const providers = require('ghcrawler').providers

module.exports = {
  filter: {
    provider: 'filter',
    filter: require('./filter/filter')
  },
  fetch: {
    cdDispatch: require('./fetch/dispatcher'),
    git: require('./fetch/gitCloner'),
    mavenCentral: require('./fetch/mavenFetch'),
    npmjs: require('./fetch/npmjsFetch'),
    nuget: require('./fetch/nugetFetch'),
    pypi: require('./fetch/pypiFetch'),
    rubygems: require('./fetch/rubyGemsFetch')
  },
  process: {
    cdsource: require('./process/sourceExtract'),
    gem: require('./process/gemExtract'),
    maven: require('./process/mavenExtract'),
    npm: require('./process/npmExtract'),
    nuget: require('./process/nugetExtract'),
    pypi: require('./process/pypiExtract'),
    package: require('./process/package'),
    scancode: require('./process/scancode'),
    source: require('./process/source'),
    top: require('./process/top'),
    vsts: require('./process/vsts')
  },
  store: {
    cdDispatch: require('./store/storeDispatcher'),
    webhook: require('./store/webhookDeltaStore'),
    'content(azblob)': HashedContentFactory(providers.store.azblob),
    'content(file)': HashedContentFactory(providers.store.file)
  }
}
