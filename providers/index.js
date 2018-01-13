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
    npmjs: require('./fetch/npmjsFetch')
  },
  process: {
    package: require('./process/package'),
    source: require('./process/source'),
    scancode: require('./process/scancode'),
    npm: require('./process/npmExtract'),
    vsts: require('./process/vsts'),
    top: require('./process/top')
  },
  store: {
    clearlyDefined: require('./store/clearlyDefined')
  }
}
