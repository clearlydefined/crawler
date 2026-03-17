// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const appInsights = require('applicationinsights')
const winston = require('winston')
const Insights = require('./insights')
const safeStringify = require('safe-stable-stringify')
const { sanitizeMeta, buildProperties } = require('./loggerUtils')

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

const sanitizeFormat = winston.format(info => {
  if (!info || typeof info !== 'object') return info
  const meta = {}
  Object.keys(info).forEach(key => {
    if (['level', 'message', 'timestamp', 'stack'].includes(key)) return
    meta[key] = info[key]
    delete info[key]
  })
  if (Object.keys(meta).length) Object.assign(info, sanitizeMeta(meta))
  return info
})

function factory(tattoos) {
  const connectionString = config.get('CRAWLER_INSIGHTS_CONNECTION_STRING')
  const echo = config.get('CRAWLER_ECHO')

  Insights.setup(tattoos, connectionString, echo)

  const logFormat = winston.format.combine(
    sanitizeFormat(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(
      ({ timestamp, level, message, ...meta }) =>
        `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? safeStringify(meta) : ''}`
    )
  )

  const consoleFormat = winston.format.combine(
    sanitizeFormat(),
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(
      ({ timestamp, level, message, ...meta }) =>
        `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? safeStringify(meta) : ''}`
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

    const properties = buildProperties(info)
    if (info.level === 'error') {
      if (info.stack) {
        aiClient.trackException({ exception: new Error(info.message), properties })
      } else {
        aiClient.trackTrace({
          message: info.message,
          severity: appInsights.KnownSeverityLevel.Error,
          properties
        })
      }
    } else {
      aiClient.trackTrace({ message: info.message, severity: mapLevel(info.level), properties })
    }
  })

  return logger
}

module.exports = factory
