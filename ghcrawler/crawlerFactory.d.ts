// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import Crawler = require('./lib/crawler')
import CrawlerService = require('./lib/crawlerService')
import QueueSet = require('./providers/queuing/queueSet')
import ScopedQueueSets = require('./providers/queuing/scopedQueueSets')
import { CrawlerOptions, Handler, Locker, DocStore } from './lib/crawler'
import { CrawlQueue } from './providers/queuing/nestedQueue'

interface QueueManager {
  createQueueChain(name: string, options: Record<string, unknown>): CrawlQueue
}

declare class CrawlerFactory {
  static createService(
    defaults: Record<string, any>,
    appLogger: CrawlerOptions['logger'],
    searchPath?: any[]
  ): CrawlerService

  static createCrawler(
    options: Record<string, any>,
    overrides?: {
      queues?: ScopedQueueSets | null
      store?: DocStore | null
      deadletters?: DocStore | null
      locker?: Locker | null
      filter?: Handler | null
      fetchers?: Handler[] | null
      processors?: Handler[] | null
    }
  ): Crawler

  static createRefreshingOptions(
    crawlerName: string,
    subsystemNames: string[],
    defaults: Record<string, any>,
    refreshingProvider?: string
  ): Promise<Record<string, any>>

  static initializeSubsystemOptions(
    config: Record<string, any>,
    defaults: Record<string, any>
  ): Promise<Record<string, any>>
  static createInMemoryRefreshingConfig(values?: Record<string, any>): any

  static getProvider(namespace: string, ...params: unknown[]): any
  static createFilter(options: Record<string, any>, processors: Handler[]): Handler
  static createStore(options: Record<string, any>, provider?: string): DocStore
  static createDeadLetterStore(options: Record<string, any>, provider?: string): DocStore
  static createFetchers(
    options: Record<string, any>,
    store: DocStore,
    processors: Handler[],
    filter: Handler
  ): Handler[]
  static createProcessors(options: Record<string, any>): Handler[]
  static createLocker(options: Record<string, any>, provider?: string): Locker
  static createNolock(): Locker
  static createQueues(options: Record<string, any>, provider?: string): ScopedQueueSets
  static createQueueSet(manager: QueueManager, options: Record<string, any>): QueueSet
  static createScopedQueueSets(
    managers: { globalManager: QueueManager; localManager: QueueManager },
    queueOptions: Record<string, any>
  ): ScopedQueueSets
}

export = CrawlerFactory
