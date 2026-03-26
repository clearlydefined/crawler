// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import Request = require('../../lib/request')
import type { CrawlQueue } from './nestedQueue'

declare class ScopedQueueSets {
  constructor(globalQueues: import('./queueSet'), localQueues: import('./queueSet'))

  addQueue(queue: CrawlQueue, location?: 'beginning' | 'end', scope?: string | null): void
  push(requests: Request | Request[], name: string, scope?: string | null): Promise<void>
  repush(original: Request, newRequest: Request): Promise<void>
  subscribe(): Promise<undefined[][]>
  unsubscribe(): Promise<undefined[][]>
  pop(): Promise<Request | null>
  done(request: Request): Promise<void>
  defer(request: Request): Promise<void>
  abandon(request: Request): Promise<void>
  getQueue(name: string, scope?: string | null): CrawlQueue
  publish(): Promise<void>
}

export = ScopedQueueSets
