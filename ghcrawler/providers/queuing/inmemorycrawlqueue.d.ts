// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import Request = require('../../lib/request')
import { CrawlQueue } from './nestedQueue'

interface InMemoryQueueOptions {
  logger: { [key: string]: unknown }
  [key: string]: unknown
}

declare class InMemoryCrawlQueue implements CrawlQueue {
  name: string
  queue: Request[]
  options: InMemoryQueueOptions
  logger: InMemoryQueueOptions['logger']

  constructor(name: string, options: InMemoryQueueOptions)

  getName(): string
  push(requests: Request | Request[]): Promise<void>
  subscribe(): Promise<void>
  unsubscribe(): Promise<void>
  pop(): Promise<Request | undefined>
  done(): Promise<void>
  defer(request: Request): Promise<void>
  abandon(request: Request): Promise<void>
  flush(): Promise<void>
  getInfo(): Promise<{ count: number; metricsName: string }>
}

export = InMemoryCrawlQueue
