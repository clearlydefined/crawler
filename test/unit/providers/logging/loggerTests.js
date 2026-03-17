// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const loggerFactory = require('../../../../providers/logging/logger')

describe('logger meta sanitization', () => {
  it('redacts sensitive headers', () => {
    const headers = {
      Authorization: 'Bearer token',
      'x-api-key': 'secret',
      cookie: 'cookie=1',
      other: 'ok'
    }
    const sanitized = loggerFactory.sanitizeHeaders(headers)
    expect(sanitized.Authorization).to.equal('[REDACTED]')
    expect(sanitized['x-api-key']).to.equal('[REDACTED]')
    expect(sanitized.cookie).to.equal('[REDACTED]')
    expect(sanitized.other).to.equal('ok')
  })

  it('sanitizes request objects to avoid circular JSON', () => {
    const req = {
      method: 'GET',
      url: '/test',
      headers: { authorization: 'secret' }
    }
    req.socket = { parser: { socket: req } }

    const meta = { req }
    const sanitized = loggerFactory.sanitizeMeta(meta)

    expect(sanitized.req).to.include({ method: 'GET', url: '/test' })
    expect(() => JSON.stringify(sanitized)).to.not.throw()
  })

  it('sanitizes axios config', () => {
    const meta = {
      config: {
        method: 'get',
        url: 'https://example.com',
        baseURL: 'https://example.com',
        headers: { Authorization: 'Bearer token' }
      }
    }

    const sanitized = loggerFactory.sanitizeMeta(meta)
    expect(sanitized.config).to.deep.equal({
      method: 'get',
      url: 'https://example.com',
      baseURL: 'https://example.com',
      headers: { Authorization: '[REDACTED]' }
    })
  })
})
