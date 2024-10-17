// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const appInsights = require('applicationinsights')
const aiLogger = require('winston-azure-application-insights').AzureApplicationInsightsLogger
const winston = require('winston')
const MockInsights = require('./mockInsights')

function factory(options) {
  const realOptions = options || {
    key: config.get('APPINSIGHTS_INSTRUMENTATIONKEY'),
    echo: false,
    level: 'info'
  }

  if (!realOptions.key || realOptions.key === 'mock') {
    MockInsights.setup(realOptions.key || 'mock', realOptions.echo)
    appInsights.defaultClient = new MockInsights(appInsights.defaultClient)
  } else {
    appInsights.setup(key).setAutoCollectPerformance(false).setAutoCollectDependencies(true).start()
  }

  const result = new winston.Logger()
  result.add(aiLogger, {
    insights: appInsights,
    treatErrorsAsExceptions: true,
    exitOnError: false,
    level: realOptions.level,
    echo: realOptions.echo
  })
  return result
}

module.exports = factory
