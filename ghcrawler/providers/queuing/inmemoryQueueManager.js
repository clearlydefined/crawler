// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AttenuatedQueue = require('./attenuatedQueue')
const InMemoryCrawlQueue = require('./inmemorycrawlqueue')

class InMemoryQueueManager {
  createQueueChain(name, options) {
    return new AttenuatedQueue(new InMemoryCrawlQueue(name, options), options)
  }
}

module.exports = InMemoryQueueManager
