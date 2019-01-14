// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

module.exports = {
  crawler: {
    count: 1
  },
  fetch: {
    github: {}
  },
  process: {
    scancode: {},
    licensee: {}
  },
  store: {
    provider: 'memory'
  },
  deadletter: {
    provider: 'memory'
  },
  queue: {
    provider: 'memory',
    memory: {
      weights: { events: 10, immediate: 3, soon: 2, normal: 3, later: 2 }
    }
  }
}
