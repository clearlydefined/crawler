// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const factory = require('../../../../providers/logging/logger')

describe('logger', function () {
  this.timeout(10000)

  let trackTrace
  let trackException
  let aiClient
  let clock

  beforeEach(() => {
    trackTrace = sinon.stub()
    trackException = sinon.stub()
    aiClient = { trackTrace, trackException }
    clock = sinon.useFakeTimers({ toFake: ['setImmediate', 'setTimeout'] })
  })

  afterEach(() => {
    clock.restore()
  })

  it('does not forward debug or verbose when logger level is info', () => {
    const logger = factory({ aiClient, echo: false })
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
    const logger = factory({ aiClient, echo: false })
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
    const logger = factory({ aiClient, echo: false })
    logger.error('plain error without stack')
    clock.runAll()

    expect(trackException.callCount).to.equal(0)
    expect(trackTrace.callCount).to.equal(1)
    expect(trackTrace.firstCall.args[0].message).to.contain('plain error without stack')
    expect(trackTrace.firstCall.args[0].severity).to.equal('Error')
  })
})
