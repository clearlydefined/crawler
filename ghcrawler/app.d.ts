// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import { Express } from 'express'
import CrawlerService = require('./lib/crawlerService')
import { CrawlerOptions } from './lib/crawler'

declare function configureApp(service: CrawlerService, logger: CrawlerOptions['logger']): Express

export = configureApp
