// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import AbstractFetch = require('./abstractFetch')
import Request = require('../../ghcrawler/lib/request')
import FetchResult = require('../../lib/fetchResult')
import MemoryCache = require('../../lib/memoryCache')
import type { Handler } from '../../ghcrawler/lib/crawler'
import type { DocStore } from '../../ghcrawler/types/docStore'
import type { BaseHandlerOptions } from '../../lib/baseHandler'

declare class FetchDispatcher extends AbstractFetch {
  store: DocStore
  fetchers: Handler[]
  processors: Handler[]
  filter: Handler

  constructor(
    options: BaseHandlerOptions & { fetched?: { defaultTtlSeconds: number }; [key: string]: unknown },
    store: DocStore,
    fetchers: Handler[],
    processors: Handler[],
    filter: Handler,
    fetchResultCache?: MemoryCache,
    inProgressFetchCache?: Record<string, Promise<FetchResult | undefined>>
  )

  canHandle(request: Request): boolean
  handle(request: Request): Promise<Request>
}

declare function createFetchDispatcher(
  options: BaseHandlerOptions & { fetched?: { defaultTtlSeconds: number }; [key: string]: unknown },
  store: DocStore,
  fetchers: Handler[],
  processors: Handler[],
  filter: Handler,
  fetchResultCache?: MemoryCache,
  inProgressFetchCache?: Record<string, Promise<FetchResult | undefined>>
): FetchDispatcher

export = createFetchDispatcher
