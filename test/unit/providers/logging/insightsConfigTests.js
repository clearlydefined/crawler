// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const Insights = require('../../../../providers/logging/insights')
const createInsights = require('../../../../providers/logging/insightsConfig')

describe('createInsights', () => {
  let createStub

  beforeEach(() => {
    createStub = sinon.stub(Insights, 'create').returns(new Insights({}, null, false))
  })

  afterEach(() => {
    createStub.restore()
  })

  function makeConfig(overrides = {}) {
    const values = {
      CRAWLER_ID: 'test-id',
      CRAWLER_HOST: 'test-host',
      APP_VERSION: '1.0.0',
      CRAWLER_INSIGHTS_CONNECTION_STRING: 'InstrumentationKey=test',
      CRAWLER_ECHO: 'false',
      ...overrides
    }
    return { get: key => values[key] }
  }

  it('passes tattoos with config values to Insights.create', () => {
    createInsights(makeConfig())
    expect(createStub.calledOnce).to.equal(true)
    const [tattoos] = createStub.firstCall.args
    expect(tattoos.crawlerId).to.equal('test-id')
    expect(tattoos.crawlerHost).to.equal('test-host')
    expect(tattoos.appVersion).to.equal('1.0.0')
  })

  it('falls back CRAWLER_ID to a UUID when config returns falsy', () => {
    createInsights(makeConfig({ CRAWLER_ID: undefined }))
    const [tattoos] = createStub.firstCall.args
    expect(tattoos.crawlerId).to.be.a('string')
    expect(tattoos.crawlerId).to.have.length.greaterThan(0)
    expect(tattoos.crawlerId).to.not.equal('test-id')
  })

  it('falls back APP_VERSION to "local" when config returns falsy', () => {
    createInsights(makeConfig({ APP_VERSION: undefined }))
    const [tattoos] = createStub.firstCall.args
    expect(tattoos.appVersion).to.equal('local')
  })

  it('passes connection string to Insights.create', () => {
    createInsights(makeConfig())
    const [, connectionString] = createStub.firstCall.args
    expect(connectionString).to.equal('InstrumentationKey=test')
  })

  it('parses CRAWLER_ECHO "true" as echo=true', () => {
    createInsights(makeConfig({ CRAWLER_ECHO: 'true' }))
    const [, , echo] = createStub.firstCall.args
    expect(echo).to.equal(true)
  })

  it('parses CRAWLER_ECHO "false" as echo=false', () => {
    createInsights(makeConfig({ CRAWLER_ECHO: 'false' }))
    const [, , echo] = createStub.firstCall.args
    expect(echo).to.equal(false)
  })

  it('parses CRAWLER_ECHO null/undefined as echo=false', () => {
    createInsights(makeConfig({ CRAWLER_ECHO: null }))
    const [, , echo] = createStub.firstCall.args
    expect(echo).to.equal(false)
  })

  it('handles CRAWLER_ECHO with whitespace and mixed case', () => {
    createInsights(makeConfig({ CRAWLER_ECHO: ' True ' }))
    const [, , echo] = createStub.firstCall.args
    expect(echo).to.equal(true)
  })

  it('returns the Insights instance from Insights.create', () => {
    const expected = new Insights({}, null, false)
    createStub.returns(expected)
    const result = createInsights(makeConfig())
    expect(result).to.equal(expected)
  })
})
