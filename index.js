// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const current = require(config.get('CRAWLER_OPTIONS') || './config/cdConfig')
const defaultConfig = require('./config/cdConfig')
const containedConfig = require('./config/containedConfig')
const run = require('ghcrawler').run
const crawlerFactory = require('ghcrawler').crawlerFactory
const searchPath = [require('./providers')]
const maps = require('./config/map')
const uuid = require('node-uuid')
const logger = require('./providers/logging/logger')({
  crawlerId: config.get('CRAWLER_ID') || uuid.v4(),
  crawlerHost: config.get('CRAWLER_HOST'),
  buildNumber: config.get('CRAWLER_BUILD_NUMBER') || 'local'
})

const defaultService = crawlerFactory.createService(defaultConfig, logger)
const containedService = crawlerFactory.createService(containedConfig, logger)

run(current, logger, searchPath, maps)

module.exports = { containedService, defaultService }
