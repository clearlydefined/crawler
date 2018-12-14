// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AttachmentStoreFactory = require('./store/attachmentStoreFactory')
const providers = require('ghcrawler').providers

module.exports = {
  filter: {
    provider: 'filter',
    filter: require('./filter/filter')
  },
  fetch: {
    cdDispatch: require('./fetch/dispatcher'),
    cocoapods: require('./fetch/podFetch'),
    cratesio: require('./fetch/crateFetch'),
    git: require('./fetch/gitCloner'),
    mavenCentral: require('./fetch/mavenFetch'),
    npmjs: require('./fetch/npmjsFetch'),
    nuget: require('./fetch/nugetFetch'),
    pypi: require('./fetch/pypiFetch'),
    rubygems: require('./fetch/rubyGemsFetch')
  },
  process: {
    cdsource: require('./process/sourceExtract'),
    component: require('./process/component'),
    crate: require('./process/crateExtract'),
    gem: require('./process/gemExtract'),
    maven: require('./process/mavenExtract'),
    npm: require('./process/npmExtract'),
    nuget: require('./process/nugetExtract'),
    pypi: require('./process/pypiExtract'),
    package: require('./process/package').processor,
    pod: require('./process/podExtract'),
    scancode: require('./process/scancode'),
    fossology: require('./process/fossology'),
    source: require('./process/source').processor,
    top: require('./process/top')
  },
  store: {
    cdDispatch: require('./store/storeDispatcher'),
    webhook: require('./store/webhookDeltaStore'),
    'cd(azblob)': AttachmentStoreFactory(providers.store.azblob),
    'cd(file)': AttachmentStoreFactory(providers.store.file)
  }
}
