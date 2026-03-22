// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import StorageQueueManager = require('./storageQueueManager')
import AttenuatedQueue = require('./attenuatedQueue')

declare class StorageBackedInMemoryQueueManager {
  constructor(storageQueueManager: StorageQueueManager)

  createQueueChain(name: string, options: Record<string, unknown>): AttenuatedQueue
}

export = StorageBackedInMemoryQueueManager
