// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const REDACTED = '[REDACTED]'
const OMITTED_REQUEST = '[request omitted]'
const OMITTED_RESPONSE = '[response omitted]'
const SENSITIVE_HEADERS = new Set(['authorization', 'proxy-authorization', 'cookie', 'set-cookie', 'x-api-key'])

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
  // Only non-sensitive IDs are extracted – no need to sanitize headers here
  const headers = request.headers
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
    if (key === 'request') {
      sanitized[key] = OMITTED_REQUEST
      return
    }
    if (key === 'response') {
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

/**
 * AppInsights v3 internally accesses value.constructor.name when converting
 * telemetry properties to log records. Objects with a null prototype (e.g.,
 * Express req.params via Object.create(null)) lack .constructor, causing
 * TypeError. This function rehydrates such objects into plain Objects.
 * @param {Record<string, any>} info
 * @returns {Record<string, any>}
 */
function buildProperties(info) {
  return Object.fromEntries(
    Object.entries(info || {}).map(([key, value]) => {
      // Fix null-prototype objects
      if (value && typeof value === 'object' && Object.getPrototypeOf(value) === null) {
        // Rehydrate into a plain object with normal prototype
        try {
          value = Object.assign({}, value)
        } catch {
          // It is possible to have null‑prototype objects with throwing getters.
          // As a last resort, stringify
          try {
            value = JSON.stringify(value)
          } catch {
            value = '[unserializable object]'
          }
        }
      }
      return [key, value]
    })
  )
}

module.exports = {
  sanitizeHeaders,
  summarizeRequest,
  summarizeResponse,
  sanitizeAxiosConfig,
  sanitizeMeta,
  buildProperties
}
