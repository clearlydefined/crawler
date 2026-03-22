// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import Crawler = require('./lib/crawler')
import CrawlerService = require('./lib/crawlerService')
import QueueSet = require('./providers/queuing/queueSet')
import ScopedQueueSets = require('./providers/queuing/scopedQueueSets')
import { CrawlerOptions, DocStore, Handler, Locker } from './lib/crawler'
import { CrawlQueue } from './providers/queuing/nestedQueue'

/** Provider search path entries map namespace → provider name → factory function */
type ProviderSearchPathEntry = Record<string, Record<string, (...args: unknown[]) => unknown>>

interface QueueManager {
  createQueueChain(name: string, options: Record<string, unknown>): CrawlQueue
}

declare class CrawlerFactory {
  static createService(
    defaults: Record<string, unknown>,
    appLogger: CrawlerOptions['logger'],
    searchPath?: ProviderSearchPathEntry[]
  ): CrawlerService

  static createCrawler(
    options: Record<string, unknown>,
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
    defaults: Record<string, unknown>,
    refreshingProvider?: string
  ): Promise<Record<string, unknown>>

  static initializeSubsystemOptions(
    config: Record<string, unknown>,
    defaults: Record<string, unknown>
  ): Promise<Record<string, unknown>>
  static createInMemoryRefreshingConfig(values?: Record<string, unknown>): unknown

  static getProvider(namespace: string, ...params: unknown[]): unknown
  static createFilter(options: Record<string, unknown>, processors: Handler[]): Handler
  static createStore(options: Record<string, unknown>, provider?: string): DocStore
  static createDeadLetterStore(options: Record<string, unknown>, provider?: string): DocStore
  static createFetchers(
    options: Record<string, unknown>,
    store: DocStore,
    processors: Handler[],
    filter: Handler
  ): Handler[]
  static createProcessors(options: Record<string, unknown>): Handler[]
  static createLocker(options: Record<string, unknown>, provider?: string): Locker
  static createNolock(): Locker
  static createQueues(options: Record<string, unknown>, provider?: string): ScopedQueueSets
  static createQueueSet(manager: QueueManager, options: Record<string, unknown>): QueueSet
  static createScopedQueueSets(
    managers: { globalManager: QueueManager; localManager: QueueManager },
    queueOptions: Record<string, unknown>
  ): ScopedQueueSets
}

export = CrawlerFactory
