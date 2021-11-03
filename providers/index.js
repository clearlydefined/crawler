// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AttachmentStoreFactory = require('./store/attachmentStoreFactory')
const providers = require('../ghcrawler').providers

module.exports = {
  filter: {
    provider: 'filter',
    filter: require('./filter/filter')
  },
  fetch: {
    cdDispatch: require('./fetch/dispatcher'),
    cocoapods: require('./fetch/podFetch'),
    packagist: require('./fetch/packagistFetch'),
    cratesio: require('./fetch/cratesioFetch'),
    debian: require('./fetch/debianFetch'),
    git: require('./fetch/gitCloner'),
    go: require('./fetch/goFetch'),
    mavenCentral: require('./fetch/mavencentralFetch'),
    mavenGoogle: require('./fetch/mavenGoogleFetch'),
    npmjs: require('./fetch/npmjsFetch'),
    nuget: require('./fetch/nugetFetch'),
    pypi: require('./fetch/pypiFetch'),
    rubygems: require('./fetch/rubyGemsFetch')
  },
  process: {
    cdsource: require('./process/sourceExtract'),
    component: require('./process/component'),
    crate: require('./process/crateExtract'),
    deb: require('./process/debExtract'),
    debsrc: require('./process/debsrcExtract'),
    gem: require('./process/gemExtract'),
    go: require('./process/goExtract'),
    licensee: require('./process/licensee'),
    maven: require('./process/mavenExtract'),
    npm: require('./process/npmExtract'),
    nuget: require('./process/nugetExtract'),
    pypi: require('./process/pypiExtract'),
    package: require('./process/package').processor,
    composer: require('./process/composerExtract'),
    pod: require('./process/podExtract'),
    scancode: require('./process/scancode'),
    fossology: require('./process/fossology'),
    source: require('./process/source').processor,
    top: require('./process/top')
  },
  store: {
    cdDispatch: require('./store/storeDispatcher'),
    webhook: require('./store/webhookDeltaStore'),
    azqueue: require('./store/azureQueueStore'),
    'cd(azblob)': AttachmentStoreFactory(providers.store.azblob),
    'cd(file)': AttachmentStoreFactory(providers.store.file)
  }
}
