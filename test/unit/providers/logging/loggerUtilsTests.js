// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const { sanitizeHeaders, sanitizeMeta, buildProperties } = require('../../../../providers/logging/loggerUtils')

describe('logger meta sanitization', () => {
  it('redacts sensitive headers', () => {
    const headers = {
      Authorization: 'Bearer token',
      'x-api-key': 'secret',
      cookie: 'cookie=1',
      other: 'ok'
    }
    const sanitized = sanitizeHeaders(headers)
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
    const sanitized = sanitizeMeta(meta)

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

    const sanitized = sanitizeMeta(meta)
    expect(sanitized.config).to.deep.equal({
      method: 'get',
      url: 'https://example.com',
      baseURL: 'https://example.com',
      headers: { Authorization: '[REDACTED]' }
    })
  })
})

describe('buildProperties', () => {
  const createNullProtoDict = (entries = {}) => Object.assign(Object.create(null), entries)
  const withThrowingGetter = (dict = createNullProtoDict()) => {
    const getter = () => {
      throw new Error('nope')
    }
    Object.defineProperty(dict, 'x', { enumerable: true, get: getter })
    return dict
  }

  it('rehydrates null-prototype dictionary to plain object', () => {
    const info = { requestParams: createNullProtoDict({ foo: 'bar' }) }
    const result = buildProperties(info)
    expect(result.requestParams).to.deep.equal({ foo: 'bar' })
    expect(Object.getPrototypeOf(result.requestParams)).to.equal(Object.prototype)
  })

  it('leaves plain objects unchanged (by reference)', () => {
    const obj = { a: 1, b: 'x' }
    const result = buildProperties({ meta: obj })
    expect(result.meta).to.equal(obj)
  })

  it('passes through arrays and primitives', () => {
    const info = { list: [1, 2, 3], s: 'str', n: 42, b: true, u: undefined, nl: null }
    const result = buildProperties(info)
    expect(result).to.deep.equal(info)
  })

  it('falls back to "[unserializable object]" when getter throws on null-prototype', () => {
    const dict = withThrowingGetter()
    const result = buildProperties({ requestParams: dict })
    expect(result.requestParams).to.equal('[unserializable object]')
  })

  it('uses JSON.stringify via toJSON when assign fails but stringify succeeds', () => {
    const dict = withThrowingGetter()
    Object.defineProperty(dict, 'toJSON', { value: () => ({ safe: 'ok' }) })
    const result = buildProperties({ requestParams: dict })
    expect(result.requestParams).to.equal(JSON.stringify({ safe: 'ok' }))
  })

  it('does not process nested null-prototype objects (shallow only)', () => {
    const nested = createNullProtoDict({ a: 'b' })
    const parent = { child: nested }
    const result = buildProperties({ parent })
    expect(result.parent.child).to.equal(nested)
  })
})
