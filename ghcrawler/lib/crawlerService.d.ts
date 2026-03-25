// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import Crawler = require('./crawler')
import Request = require('./request')

import { StoredDocument } from '../types/docStore'

interface CrawlerServiceOptions {
  crawler: {
    count: number | { value: number }
    _config: { on(event: string, handler: (...args: any[]) => void): void }
    [key: string]: unknown
  }
  [key: string]: unknown
}

declare class CrawlerService {
  crawler: Crawler | Promise<[Crawler, CrawlerServiceOptions]>
  options: CrawlerServiceOptions
  loops: CrawlerLoop[]

  constructor(crawler: Crawler | Promise<[Crawler, CrawlerServiceOptions]>, options?: CrawlerServiceOptions)

  ensureInitialized(): Promise<void>
  run(): Promise<void>
  ensureLoops(targetCount?: number): Promise<void>
  status(): number
  stop(): Promise<void>
  queues(): import('../providers/queuing/scopedQueueSets')
  queue(requests: Request | Request[], name?: string): Promise<void>
  flushQueue(name: string, scope?: string | null): Promise<void | null>
  getQueueInfo(name: string, scope?: string | null): Promise<{ count: number; metricsName: string }>
  getRequests(name: string, count: number, remove?: boolean, scope?: string | null): Promise<Request[] | null>
  listDeadletters(): Promise<StoredDocument[]>
  getDeadletter(urn: string): Promise<StoredDocument>
  deleteDeadletter(urn: string): Promise<boolean | void>
  requeueDeadletter(url: string, queue: string): Promise<void>
  getDeadletterCount(): Promise<number>
}

declare class CrawlerLoop {
  crawler: Crawler
  options: { name: string; delay: number; done?: (value?: unknown) => void }
  state: string | null

  constructor(crawler: Crawler, name: string)

  running(): boolean
  run(): Promise<void>
  stop(): void
}

export = CrawlerService
export { CrawlerLoop, CrawlerServiceOptions }
