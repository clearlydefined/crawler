// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const CrawlerFactory = require('../../crawlerFactory')
const InMemoryQueueManager = require('./inmemoryQueueManager')

module.exports = options => {
  const manager = new InMemoryQueueManager()
  return CrawlerFactory.createScopedQueueSets({ globalManager: manager, localManager: manager }, options)
}
