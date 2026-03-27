// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const uuid = require('node-uuid')
const Insights = require('./insights')

function createInsightsContext(config) {
  const tattoos = {
    crawlerId: config.get('CRAWLER_ID') || uuid.v4(),
    crawlerHost: config.get('CRAWLER_HOST'),
    appVersion: config.get('APP_VERSION') || 'local'
  }

  const connectionString = config.get('CRAWLER_INSIGHTS_CONNECTION_STRING')
  const rawEcho = config.get('CRAWLER_ECHO')
  const echo =
    String(rawEcho ?? '')
      .trim()
      .toLowerCase() === 'true'

  const aiClient = Insights.create(tattoos, connectionString, echo)

  return { aiClient, echo }
}

module.exports = createInsightsContext
