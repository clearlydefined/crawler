// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import CrawlerService = require('../lib/crawlerService')
import type { Server } from 'node:http'
import type { Logger } from '../lib/request'

declare function run(
  service: CrawlerService | undefined,
  logger: Logger
): { server: Server; port: number | string | false | null }

export = run
