// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import CrawlerService = require('./lib/crawlerService')
import { CrawlerOptions } from './lib/crawler'

declare function run(service: CrawlerService, logger: CrawlerOptions['logger']): void

export = run
