// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AttenuatedQueue = require('./attenuatedQueue')
const StorageBackedInMemoryQueue = require('./storageBackedInMemoryQueue')
const InMemoryCrawlQueue = require('./inmemorycrawlqueue')

class StorageBackedInMemoryQueueManager {
  constructor(storageQueueManager) {
    this._storageQueueManager = storageQueueManager
  }
  createQueueChain(name, options) {
    const storageQueue = this._storageQueueManager.createQueue(name, options)
    const inMemoryQueue = new InMemoryCrawlQueue(name, options)
    const queue = StorageBackedInMemoryQueue.create(inMemoryQueue, storageQueue, options)
    return new AttenuatedQueue(queue, options)
  }
}

module.exports = StorageBackedInMemoryQueueManager
