// Copyright (c) Microsoft Corporation and others. Made available under the MIT license.
// SPDX-License-Identifier: MIT

import type { QueueServiceClient } from '@azure/storage-queue'
import StorageQueue = require('./storageQueue')
import AttenuatedQueue = require('./attenuatedQueue')
import Request = require('../../lib/request')

declare class StorageQueueManager {
  client: QueueServiceClient

  constructor(connectionString: string | undefined, options: Record<string, unknown>)

  createQueueClient(
    name: string,
    formatter: (message: { body: Record<string, unknown> }) => Request,
    options: Record<string, unknown>
  ): StorageQueue

  createQueueChain(name: string, options: Record<string, unknown>): AttenuatedQueue
  createQueue(name: string, options: Record<string, unknown>): StorageQueue
}

export = StorageQueueManager
