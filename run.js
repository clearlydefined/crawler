// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const defaults = require(config.get('CRAWLER_OPTIONS') || './config/cdConfig')
const run = require('ghcrawler').run
const searchPath = [require('./providers')]
const maps = require('./config/map')
const uuid = require('node-uuid')
const logger = require('./providers/logging/logger')({
  crawlerId: config.get('CRAWLER_ID') || uuid.v4(),
  crawlerHost: config.get('CRAWLER_HOST')
})

run(defaults, logger, searchPath, maps)
