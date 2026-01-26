// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const appInsights = require('applicationinsights')
const winston = require('winston')
const Insights = require('./insights')

const levelMap = new Map([
  ['error', appInsights.KnownSeverityLevel.Error],
  ['warn', appInsights.KnownSeverityLevel.Warning],
  ['info', appInsights.KnownSeverityLevel.Information],
  ['verbose', appInsights.KnownSeverityLevel.Verbose],
  ['debug', appInsights.KnownSeverityLevel.Verbose],
  ['silly', appInsights.KnownSeverityLevel.Verbose]
])

/**
 * Maps Winston log levels to Application Insights severity levels
 * @param {string} level - The Winston log level
 * @returns {string} - The corresponding Application Insights severity level
 */
function mapLevel(level) {
  return levelMap.get(level) ?? appInsights.KnownSeverityLevel.Information
}

function factory(tattoos) {
  const connectionString = config.get('CRAWLER_INSIGHTS_CONNECTION_STRING')
  const echo = config.get('CRAWLER_ECHO')

  Insights.setup(tattoos, connectionString, echo)

  const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(
      ({ timestamp, level, message, ...meta }) =>
        `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
    )
  )

  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.printf(
      ({ timestamp, level, message, ...meta }) =>
        `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
    )
  )

  const logger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
      new winston.transports.Console({
        format: consoleFormat,
        silent: !echo
      })
    ]
  })

  const aiClient = Insights.getClient()

  // Pipe Winston logs to Application Insights
  logger.on('data', info => {
    if (!aiClient) return

    if (info.level === 'error') {
      if (info.stack) {
        aiClient.trackException({ exception: new Error(info.message), properties: info })
      } else {
        aiClient.trackTrace({
          message: info.message,
          severity: appInsights.KnownSeverityLevel.Error,
          properties: info
        })
      }
    } else {
      aiClient.trackTrace({ message: info.message, severity: mapLevel(info.level), properties: info })
    }
  })

  return logger
}

module.exports = factory
