// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const aiLogger = require('winston-azure-application-insights').AzureApplicationInsightsLogger
const winston = require('winston')
const mockInsights = require('./mockInsights')
const appInsights = require('applicationinsights')

function factory(options) {
  appInsights.setup(options)
  if (!options.key || options.key === 'mock') mockInsights.setup('mock', realOptions.echo)

  const result = new winston.Logger()
  result.add(aiLogger, {
    insights: appInsights,
    echo: options.echo,
    treatErrorsAsExceptions: true,
    exitOnError: false,
    level: options.level
  })
  return result
}

module.exports = factory
