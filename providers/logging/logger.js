// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const appInsights = require('applicationinsights')
const winston = require('winston')
const insights = require('./insights')


/**
 * Factory function to create a Winston logger instance.
 * @param {Object} [options] - Configuration options for the logger.
 * @param {boolean} [options.echo] - Whether to echo logs to the console.
 * @param {string} [options.level] - Log level (e.g., 'debug', 'info').
 */
function factory(options = {}) {
  const realOptions = {
    key: config.get('CRAWLER_INSIGHTS_KEY'),
    echo: config.get('CRAWLER_ECHO') === 'true' ? true : false || false,
    level: config.get('CRAWLER_LOG_LEVEL') || 'info',
    ...options
  }

  insights.setup({}, realOptions.key || 'mock', realOptions.echo)

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
    level: realOptions.level,
    format: logFormat,
    transports: [
      new winston.transports.Console({
        format: consoleFormat,
        silent: !realOptions.echo
      })
    ]
  })

  if (realOptions.key && realOptions.key !== 'mock') {
    appInsights.setup(realOptions.key).setAutoCollectConsole(false).setAutoCollectExceptions(false).start()
    const aiClient = appInsights.defaultClient

    logger.on('data', info => {
      if (info.level === 'error') {
        aiClient.trackException({ exception: new Error(info.message), properties: info })
      } else {
        aiClient.trackTrace({ message: info.message, severity: mapLevel(info.level), properties: info })
      }
    })
  }

  return logger
}


/**
 * Maps Winston log levels to Application Insights severity levels
 * @param {string} level - The Winston log level
 * @returns {number} - The corresponding Application Insights severity level
 */
function mapLevel(level) {
  switch (level) {
    case 'error':
      return appInsights.Contracts.SeverityLevel.Error
    case 'warn':
      return appInsights.Contracts.SeverityLevel.Warning
    case 'info':
      return appInsights.Contracts.SeverityLevel.Information
    case 'verbose':
    case 'debug':
    case 'silly':
      return appInsights.Contracts.SeverityLevel.Verbose
    default:
      return appInsights.Contracts.SeverityLevel.Information
  }
}

module.exports = factory


