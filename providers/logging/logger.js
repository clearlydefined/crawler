// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const appInsights = require('applicationinsights')
const winston = require('winston')
const Insights = require('./insights')

const REDACTED = '[REDACTED]'
const OMITTED_REQUEST = '[request omitted]'
const OMITTED_RESPONSE = '[response omitted]'
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key'
])

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

function sanitizeHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers
  return Object.keys(headers).reduce((result, key) => {
    const lowerKey = key.toLowerCase()
    result[key] = SENSITIVE_HEADERS.has(lowerKey) ? REDACTED : headers[key]
    return result
  }, {})
}

function summarizeRequest(request) {
  if (!request || typeof request !== 'object') return request
  const headers = sanitizeHeaders(request.headers)
  return {
    method: request.method,
    url: request.originalUrl || request.url,
    requestId: headers?.['x-request-id'] || headers?.['X-Request-Id'],
    correlationId: headers?.['x-correlation-id'] || headers?.['X-Correlation-Id']
  }
}

function summarizeResponse(response) {
  if (!response || typeof response !== 'object') return response
  return {
    statusCode: response.statusCode,
    statusMessage: response.statusMessage
  }
}

function sanitizeAxiosConfig(config) {
  if (!config || typeof config !== 'object') return config
  return {
    method: config.method,
    url: config.url,
    baseURL: config.baseURL,
    headers: sanitizeHeaders(config.headers)
  }
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return meta
  const sanitized = {}
  Object.keys(meta).forEach(key => {
    const value = meta[key]
    if (key === 'req') {
      sanitized[key] = summarizeRequest(value)
      return
    }
    if (key === 'res') {
      sanitized[key] = summarizeResponse(value)
      return
    }
    if (key === 'request' && !meta.req) {
      sanitized[key] = OMITTED_REQUEST
      return
    }
    if (key === 'response' && !meta.res) {
      sanitized[key] = OMITTED_RESPONSE
      return
    }
    if (key === 'config') {
      sanitized[key] = sanitizeAxiosConfig(value)
      return
    }
    if (value instanceof Error) {
      sanitized[key] = { name: value.name, message: value.message, stack: value.stack }
      return
    }
    sanitized[key] = value
  })
  return sanitized
}

function safeStringify(value) {
  const seen = new WeakSet()
  return JSON.stringify(value, (key, val) => {
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) return '[Circular]'
      seen.add(val)
    }
    return val
  })
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
    winston.format.colorize(),
    sanitizeFormat(),
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

factory.sanitizeHeaders = sanitizeHeaders
factory.sanitizeMeta = sanitizeMeta
factory.safeStringify = safeStringify

module.exports = factory
