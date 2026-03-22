// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import Crawler = require('./lib/crawler')
import CrawlerService = require('./lib/crawlerService')
import CrawlerFactory = require('./crawlerFactory')
import TraversalPolicy = require('./lib/traversalPolicy')
import QueueSet = require('./providers/queuing/queueSet')
import Request = require('./lib/request')
import VisitorMap = require('./lib/visitorMap')
import { CrawlerOptions } from './lib/crawler'

export { Crawler as crawler }
export { CrawlerService as crawlerService }
export { CrawlerFactory as crawlerFactory }
export { TraversalPolicy as policy }
export { QueueSet as queueSet }
export { Request as request }
export { TraversalPolicy as traversalPolicy }
export { VisitorMap as visitorMap }
export const providers: Record<string, Record<string, (...args: any[]) => any>>

export function run(
  defaults: Record<string, any>,
  logger: CrawlerOptions['logger'],
  searchPath: any[],
  maps: Record<string, any>
): void
