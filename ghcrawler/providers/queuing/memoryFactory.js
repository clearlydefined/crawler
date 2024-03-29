// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const CrawlerFactory = require('../../crawlerFactory')
const AttenuatedQueue = require('./attenuatedQueue')
const InMemoryCrawlQueue = require('./inmemorycrawlqueue')

module.exports = options => {
  const manager = {
    createQueueChain: (name, options) => {
      return new AttenuatedQueue(new InMemoryCrawlQueue(name, options), options)
    }
  }
  return CrawlerFactory.createScopedQueueSets({ globalManager: manager, localManager: manager }, options)
}
