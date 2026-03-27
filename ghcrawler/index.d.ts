// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import Crawler = require('./lib/crawler')
import CrawlerService = require('./lib/crawlerService')
import CrawlerFactory = require('./crawlerFactory')
import TraversalPolicy = require('./lib/traversalPolicy')
import QueueSet = require('./providers/queuing/queueSet')
import Request = require('./lib/request')
import VisitorMap = require('./lib/visitorMap')
import type { CrawlerOptions } from './lib/crawler'

export {
  Crawler as crawler,
  CrawlerFactory as crawlerFactory,
  CrawlerService as crawlerService,
  TraversalPolicy as policy,
  QueueSet as queueSet,
  Request as request,
  TraversalPolicy as traversalPolicy,
  VisitorMap as visitorMap
}
export declare const providers: Record<string, Record<string, (...args: unknown[]) => unknown>>

export function run(
  defaults: Record<string, unknown>,
  logger: CrawlerOptions['logger'],
  searchPath: Record<string, Record<string, (...args: unknown[]) => unknown>>[],
  maps: Record<string, unknown>
): CrawlerService
