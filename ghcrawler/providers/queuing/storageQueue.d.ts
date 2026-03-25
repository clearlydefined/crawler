// Copyright (c) Microsoft Corporation and others. Made available under the MIT license.
// SPDX-License-Identifier: MIT

import type { QueueServiceClient } from '@azure/storage-queue'
import type { CrawlQueue } from './nestedQueue'
import Request = require('../../lib/request')

interface StorageQueueOptions {
  parallelPush?: number
  visibilityTimeout?: number
  maxDequeueCount?: number
  queueName: string
  logger: {
    info(message: string): void
    verbose(message: string): void
    error(message: string, ...args: unknown[]): void
  }
  [key: string]: unknown
}

declare class StorageQueue implements CrawlQueue {
  name: string
  queueName: string
  options: StorageQueueOptions
  logger: StorageQueueOptions['logger']

  constructor(
    client: QueueServiceClient,
    name: string,
    queueName: string,
    formatter: (message: { body: Record<string, unknown> }) => Request,
    options: StorageQueueOptions
  )

  getName(): string
  subscribe(): Promise<void>
  unsubscribe(): Promise<void>
  push(requests: Request | Request[]): Promise<{ _message: Record<string, unknown> }[]>
  pop(): Promise<Request | null>
  done(request: Request): Promise<void>
  defer(request: Request): Promise<void>
  abandon(request: Request): Promise<void>
  updateVisibilityTimeout(request: Request, visibilityTimeout?: number): Promise<{ _message: Record<string, unknown> }>
  flush(): Promise<void>
  getInfo(): Promise<{ count: number } | null>
  isMessageNotFound(error: unknown): boolean
}

export = StorageQueue
