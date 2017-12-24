// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

module.exports = {
  fetch: {
    git: require('./fetch/gitCloner')
  },
  process: {
    scancode: require('./process/scancode')
  },
  store: {
    clearlyDefined: require('./store/clearlyDefined')
  }
}
