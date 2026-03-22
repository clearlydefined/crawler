// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import Request = require('../../lib/request')
import { CrawlQueue } from './nestedQueue'

interface QueueSetOptions {
  weights?: Record<string, number>
  _config: { on(event: string, handler: (...args: any[]) => void): void }
  [key: string]: unknown
}

declare class QueueSet {
  queues: CrawlQueue[]
  options: QueueSetOptions
  startMap: number[]
  popCount: number

  constructor(queues: CrawlQueue[], options: QueueSetOptions)

  addQueue(queue: CrawlQueue, location?: 'beginning' | 'end'): void
  push(requests: Request | Request[], name: string): Promise<void>
  subscribe(): Promise<void[]>
  unsubscribe(): Promise<void[]>
  pop(startMap?: number[]): Promise<Request | null>
  getQueue(name: string): CrawlQueue
}

export = QueueSet
