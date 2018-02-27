// Copyright (c) Microsoft Corporation.
// SPDX-License-Identifier: MIT

module.exports = {
  filter: {
    provider: 'filter',
    filter: require('./filter/filter')
  },
  fetch: {
    cdDispatch: require('./fetch/dispatcher'),
    git: require('./fetch/gitCloner'),
    mavenCentral: require('./fetch/mavenFetch'),
    npmjs: require('./fetch/npmjsFetch')
  },
  process: {
    cdsource: require('./process/sourceExtract'),
    maven: require('./process/mavenExtract'),
    npm: require('./process/npmExtract'),
    package: require('./process/package'),
    scancode: require('./process/scancode'),
    source: require('./process/source'),
    top: require('./process/top'),
    vsts: require('./process/vsts')
  },
  store: {
    cdDispatch: require('./store/storeDispatcher'),
    webhook: require('./store/webhookDeltaStore')
  }
}
