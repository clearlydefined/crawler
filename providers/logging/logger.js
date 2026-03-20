// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const appInsights = require('applicationinsights')
const winston = require('winston')
const Transport = require('winston-transport')
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

class ApplicationInsightsTransport extends Transport {
  constructor({ aiClient, level, format } = {}) {
    super({ level, format })
    this.aiClient = aiClient
  }

  log(info, callback) {
    setImmediate(() => this.emit('logged', info))

    if (!this.aiClient || !info) {
      callback()
      return
    }

    const properties = buildProperties(info)
    if (info.level === 'error') {
      if (info.stack) {
        const err = new Error(info.message)
        err.stack = info.stack
        this.aiClient.trackException({ exception: err, properties })
      } else {
        this.aiClient.trackTrace({
          message: info.message,
          severity: appInsights.KnownSeverityLevel.Error,
          properties
        })
      }
    } else {
      this.aiClient.trackTrace({
        message: info.message,
        severity: mapLevel(info.level),
        properties
      })
    }

    callback()
  }
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
  const rawEcho = config.get('CRAWLER_ECHO')
  const echo = rawEcho === undefined ? undefined : rawEcho === 'true'

  Insights.setup(tattoos, connectionString, echo)
  const aiClient = Insights.getClient()

  const logFormat = winston.format.combine(
    sanitizeFormat(),
    winston.format.errors({ stack: true }),
  )

  const consoleFormat = winston.format.combine(
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
      }),
      new ApplicationInsightsTransport({
        aiClient
      })
    ]
  })

  return logger
}

module.exports = factory
