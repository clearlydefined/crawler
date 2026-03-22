// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import { Express } from 'express'
import { CrawlerOptions } from './lib/crawler'
import CrawlerService = require('./lib/crawlerService')

declare function configureApp(service: CrawlerService, logger: CrawlerOptions['logger']): Express

export = configureApp
