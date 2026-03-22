// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import AbstractFetch = require('./abstractFetch')
import Request = require('../../ghcrawler/lib/request')
import { DocStore } from '../../ghcrawler/lib/crawler'
import { Handler } from '../../ghcrawler/lib/crawler'

declare class FetchDispatcher extends AbstractFetch {
  store: DocStore
  fetchers: Handler[]
  processors: Handler[]
  filter: Handler

  constructor(
    options: Record<string, any>,
    store: DocStore,
    fetchers: Handler[],
    processors: Handler[],
    filter: Handler,
    fetchResultCache?: any,
    inProgressFetchCache?: Record<string, Promise<any>>
  )

  canHandle(request: Request): boolean
  handle(request: Request): Promise<Request>
}

declare function createFetchDispatcher(
  options: Record<string, any>,
  store: DocStore,
  fetchers: Handler[],
  processors: Handler[],
  filter: Handler,
  fetchResultCache?: any,
  inProgressFetchCache?: Record<string, Promise<any>>
): FetchDispatcher

export = createFetchDispatcher
