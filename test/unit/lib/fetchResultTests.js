// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const FetchResult = require('../../../lib/fetchResult')

describe('fetchResult', () => {
  let fetchResult
  const errorHandler = sinon.stub()

  beforeEach(() => {
    fetchResult = new FetchResult()
  })

  it('clean up callback success', () => {
    const cleanup = sinon.stub()
    fetchResult.trackCleanup(cleanup)
    fetchResult.cleanup(errorHandler)
    expect(cleanup.calledOnce).to.be.true
    expect(errorHandler.called).to.be.false
  })

  it('clean up success with callback array', () => {
    const cleanup1 = sinon.stub()
    const cleanup2 = sinon.stub()
    fetchResult.trackCleanup([cleanup1, cleanup2])
    fetchResult.cleanup(errorHandler)
    expect(cleanup1.calledOnce).to.be.true
    expect(cleanup2.calledOnce).to.be.true
    expect(errorHandler.called).to.be.false
  })

  it('failure during cleanup should be logged', () => {
    const cleanup = sinon.stub().throws({ message: 'error message' })
    fetchResult.trackCleanup([cleanup, cleanup])
    fetchResult.cleanup(errorHandler)
    expect(cleanup.calledTwice).to.be.true
    expect(errorHandler.calledTwice).to.be.true
    expect(errorHandler.calledWith({ message: 'error message' })).to.be.true
  })

  it('verify copyTo', () => {
    const result = {}
    fetchResult.copyTo(result)
    expect(result).to.be.deep.equal({ contentOrigin: 'origin' })
  })

  it('verify deepCopy', () => {
    fetchResult.document = { test: true }
    const result1 = {}
    fetchResult.copyTo(result1)
    expect(result1.document).to.be.deep.equal({ test: true })
    result1.document.result1Flag = true
    expect(result1.document).to.be.deep.equal({ test: true, result1Flag: true })

    const result2 = {}
    fetchResult.copyTo(result2)
    expect(result2.document).to.be.deep.equal({ test: true })
  })

  it('verify copyTo with url', () => {
    const result = {}
    fetchResult = new FetchResult('http://localhost')
    fetchResult.copyTo(result)
    expect(result).to.be.deep.equal({ contentOrigin: 'origin', url: 'http://localhost' })
  })

  it('avoid copy for empty meta', () => {
    const result = { addMeta: sinon.stub() }
    fetchResult.copyTo(result)
    expect(result.addMeta.called).to.be.false
  })

  it('verify addMeta', () => {
    fetchResult.addMeta({ gitSize: 532 })
    const result = { addMeta: sinon.stub() }
    fetchResult.copyTo(result)
    expect(result.addMeta.calledWith({ gitSize: 532 })).to.be.true
  })
})