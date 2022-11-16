// Copyright (c) Microsoft Corporation and others. Made available under the MIT license.
// SPDX-License-Identifier: MIT

const StorageQueueManager = require('./storageQueueManager')
const CrawlerFactory = require('../../crawlerFactory')
const StorageBackedInMemoryQueueManager = require('./storageBackedInMemoryQueueManager')

module.exports = options => {
  const { connectionString } = options
  const storageQueueManager = new StorageQueueManager(connectionString, options)
  const localManager = new StorageBackedInMemoryQueueManager(storageQueueManager)
  return CrawlerFactory.createScopedQueueSets({ globalManager: storageQueueManager, localManager}, options)
}
