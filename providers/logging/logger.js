// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const appInsights = require('applicationinsights')
const aiLogger = require('winston-azure-application-insights').AzureApplicationInsightsLogger
const winston = require('winston')
const insights = require('./insights')

function factory(tattoos) {
  insights.setup(tattoos, config.get('CRAWLER_INSIGHTS_KEY'), config.get('CRAWLER_ECHO'))
  const result = new winston.Logger()
  result.add(aiLogger, {
    insights: appInsights,
    treatErrorsAsExceptions: true,
    exitOnError: false,
    level: 'info'
  })
  return result
}

module.exports = factory
