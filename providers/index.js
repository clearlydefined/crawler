// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

module.exports = {
  filter: {
    provider: 'filter',
    filter: require('./filter/filter')
  },
  fetch: {
    cdDispatch: require('./fetch/dispatcher'),
    git: require('./fetch/gitCloner'),
    // "maven-central": require('./fetch/mavenFetch'),
    // "maven-source": require('./fetch/mavenSourceFetch'),
    npmjs: require('./fetch/npmjsFetch')
  },
  process: {
    maven: require('./process/mavenExtract'),
    npm: require('./process/npmExtract'),
    package: require('./process/package'),
    scancode: require('./process/scancode'),
    source: require('./process/source'),
    top: require('./process/top'),
    vsts: require('./process/vsts')
  },
  store: {
    clearlyDefined: require('./store/clearlyDefined')
  }
}
