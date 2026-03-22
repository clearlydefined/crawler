// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'
import CrawlerService = require('../lib/crawlerService')

declare function setup(service: CrawlerService): Router

export = setup
