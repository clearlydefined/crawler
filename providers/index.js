// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

module.exports = {
  fetch: {
    git: require('./fetch/gitCloner'),
    npm: require('./fetch/npmFetch')
  },
  process: {
    source: require('./process/source'),
    scancode: require('./process/scancode'),
    npm: require('./process/npmExtract'),
    top: require('./process/top')
  },
  store: {
    clearlyDefined: require('./store/clearlyDefined')
  }
}
