// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import Request = require('./request')
import { DocStore } from '../providers/storage/inmemoryDocStore'

interface CrawlerOptions {
  name?: string
  count?: number
  drainPulse?: number
  pollingDelay?: number
  processingTtl?: number
  promiseTrace?: boolean
  requeueDelay?: number
  deadletterPolicy?: string
  maxRequeueAttemptCount?: number
  logger: import('./request').Logger
  _config: { on(event: string, handler: (...args: any[]) => void): void }
  [key: string]: unknown
}

interface Locker {
  lock(resource: string, ttl: number): Promise<any>
  unlock(lock: any): Promise<void>
}

interface Handler {
  canHandle(request: Request): boolean
  handle(request: Request): Promise<Request>
  shouldProcess?(request: Request): boolean
  shouldTraverse?(request: Request): boolean
}

interface RunContext {
  name: string
  delay: number
  currentDelay?: number
  done?: (value?: unknown) => void
}

declare class Crawler {
  queues: import('../providers/queuing/scopedQueueSets')
  store: DocStore
  deadletters: DocStore
  locker: Locker | null
  fetchers: Handler[]
  processors: Handler[]
  options: CrawlerOptions
  logger: CrawlerOptions['logger']
  counter: number
  counterRollover: number
  deferring: boolean
  drainCount: number

  constructor(
    queues: import('../providers/queuing/scopedQueueSets'),
    store: DocStore,
    deadletters: DocStore,
    locker: Locker | null,
    fetchers: Handler[],
    processors: Handler[],
    options: CrawlerOptions
  )

  initialize?(): Promise<void>

  run(context: RunContext): void
  processOne(context: RunContext): Promise<Request>
  queue(requests: Request | Request[], name?: string | null, scope?: string | null): Promise<void>
  storeDeadletter(request: Request, reason?: string | null): Promise<Request>
  done(): Promise<void>
}

export = Crawler
export { CrawlerOptions, Locker, Handler, RunContext, DocStore }
