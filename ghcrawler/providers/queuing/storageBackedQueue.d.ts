// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import NestedQueue = require('./nestedQueue')
import StorageQueue = require('./storageQueue')
import Request = require('../../lib/request')
import { CrawlQueue } from './nestedQueue'

interface StorageBackedQueueOptions {
  visibilityTimeout_remainLocal?: number
  visibilityTimeout?: number
  logger: { verbose(message: string): void }
  [key: string]: unknown
}

declare class StorageBackedQueue extends NestedQueue {
  options: StorageBackedQueueOptions
  logger: StorageBackedQueueOptions['logger']

  constructor(queue: CrawlQueue, storageQueue: StorageQueue, options: StorageBackedQueueOptions)

  push(requests: Request | Request[]): Promise<void>
  pop(): Promise<Request | undefined>
  done(request: Request): Promise<void>
  subscribe(): Promise<void>
  unsubscribe(): Promise<void>
  flush(): Promise<void>

  static create(
    queue: CrawlQueue,
    storageQueue: StorageQueue,
    options?: Partial<StorageBackedQueueOptions>
  ): StorageBackedQueue
}

export = StorageBackedQueue
