// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import Request = require('../../lib/request')

interface CrawlQueue {
  getName(): string
  push(requests: Request | Request[]): Promise<void>
  pop(): Promise<Request | undefined>
  done(request: Request): Promise<void>
  defer(request: Request): Promise<void>
  abandon(request: Request): Promise<void>
  subscribe(): Promise<void>
  unsubscribe(): Promise<void>
  flush(): Promise<void>
  getInfo(): Promise<{ count: number; metricsName: string }>
}

declare class NestedQueue implements CrawlQueue {
  queue: CrawlQueue

  constructor(queue: CrawlQueue)

  getName(): string
  push(requests: Request | Request[]): Promise<void>
  pop(): Promise<Request | undefined>
  done(request: Request): Promise<void>
  defer(request: Request): Promise<void>
  abandon(request: Request): Promise<void>
  subscribe(): Promise<void>
  unsubscribe(): Promise<void>
  flush(): Promise<void>
  getInfo(): Promise<{ count: number; metricsName: string }>
}

export = NestedQueue
export type { CrawlQueue }
