// Copyright (c) Microsoft Corporation and others. Made available under the MIT license.
// SPDX-License-Identifier: MIT

const StorageQueueManager = require('./storageQueueManager')
const CrawlerFactory = require('../../crawlerFactory')
const InMemoryQueueManager = require('./inmemoryQueueManager')

module.exports = options => {
  const { connectionString } = options
  const storageQueueManager = new StorageQueueManager(connectionString)
  const localManager = new InMemoryQueueManager()
  return CrawlerFactory.createScopedQueueSets({ globalManager: storageQueueManager, localManager }, options)
}
