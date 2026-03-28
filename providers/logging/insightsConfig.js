// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const uuid = require('node-uuid')
const Insights = require('./insights')

function createInsights(config) {
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

  return Insights.create(tattoos, connectionString, echo)
}

module.exports = createInsights
