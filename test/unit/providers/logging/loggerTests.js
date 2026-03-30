// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const proxyquire = require('proxyquire')
const sinon = require('sinon')

describe('logger', function () {
  this.timeout(10000)

  let factory
  let trackTrace
  let trackException
  let clock

  before(() => {
    const Insights = {
      setup: sinon.stub(),
      getClient: () => ({ trackTrace, trackException })
    }
    factory = proxyquire('../../../../providers/logging/logger', {
      'painless-config': {
        get: key =>
          ({
            CRAWLER_INSIGHTS_CONNECTION_STRING: 'mock',
            CRAWLER_ECHO: 'false'
          })[key]
      },
      './insights': Insights
    })
  })

  beforeEach(() => {
    trackTrace = sinon.stub()
    trackException = sinon.stub()
    clock = sinon.useFakeTimers({ toFake: ['setImmediate', 'setTimeout'] })
  })

  afterEach(() => {
    clock.restore()
  })

  it('does not forward debug or verbose when logger level is info', () => {
    const logger = factory({ service: 'test' })
    logger.debug('debug should not be sent')
    logger.verbose('verbose should not be sent')
    logger.info('info should be sent')
    clock.runAll()

    expect(trackException.called).to.equal(false)
    expect(trackTrace.callCount).to.equal(1)
    expect(trackTrace.firstCall.args[0].message).to.contain('info should be sent')
    expect(trackTrace.firstCall.args[0].severity).to.equal('Information')
  })

  it('forwards errors to exception telemetry when stack is present', () => {
    const logger = factory({ service: 'test' })
    logger.log({
      level: 'error',
      message: 'boom',
      stack: 'Error: boom\n    at test:1:1'
    })
    clock.runAll()

    expect(trackException.callCount).to.equal(1)
    expect(trackTrace.callCount).to.equal(0)
    expect(trackException.firstCall.args[0].exception.message).to.contain('boom')
    expect(trackException.firstCall.args[0].exception.stack).to.contain('Error: boom')
  })

  it('forwards errors to trace telemetry with Error severity when no stack is present', () => {
    const logger = factory({ service: 'test' })
    logger.error('plain error without stack')
    clock.runAll()

    expect(trackException.callCount).to.equal(0)
    expect(trackTrace.callCount).to.equal(1)
    expect(trackTrace.firstCall.args[0].message).to.contain('plain error without stack')
    expect(trackTrace.firstCall.args[0].severity).to.equal('Error')
  })
})
