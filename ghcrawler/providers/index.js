// Copyright (c) Microsoft Corporation and others. Made available under the MIT license.
// SPDX-License-Identifier: MIT

module.exports = {
  queue: {
    storageQueue: require('./queuing/storageQueueFactory'),
    memory: require('./queuing/memoryFactory')
  },
  store: {
    memory: require('./storage/inmemoryDocStore'),
    file: require('./storage/file'),
    azblob: require('./storage/azureBlobFactory')
  },
  lock: {
    memory: require('./locker/memory')
  }
}
