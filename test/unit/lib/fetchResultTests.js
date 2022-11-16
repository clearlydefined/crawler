// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const Request = require('../../../ghcrawler/lib/request.js')
const FetchResult = require('../../../lib/fetchResult')

describe('fetchResult', () => {
  let fetchResult
  const errorHandler = sinon.stub()

  beforeEach(() => {
    fetchResult = new FetchResult()
  })

  describe('clean up management', () => {
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

    it('adopt a cleanup', () => {
      const dir = { removeCallback: sinon.stub() }
      const request = new Request('test', 'http://test').trackCleanup(dir.removeCallback)
      expect(request.getTrackedCleanups().length).to.be.equal(1)

      fetchResult.adoptCleanup(dir, request)
      expect(request.getTrackedCleanups().length).to.be.equal(0)

      fetchResult.cleanup()
      expect(dir.removeCallback.calledOnce).to.be.true
    })

    it('adopt multiple cleanups', () => {
      const dir1 = { removeCallback: sinon.stub() }
      const dir2 = { removeCallback: sinon.stub() }
      const request = new Request('test', 'http://test').trackCleanup([
        dir1.removeCallback,
        dir2.removeCallback,
        { removeCallback: sinon.stub() }])
      expect(request.getTrackedCleanups().length).to.be.equal(3)

      fetchResult.adoptCleanup([dir1, dir2], request)
      expect(request.getTrackedCleanups().length).to.be.equal(1)

      fetchResult.cleanup()
      expect(dir1.removeCallback.calledOnce).to.be.true
      expect(dir2.removeCallback.calledOnce).to.be.true
    })
  })

  describe('copyTo', () => {
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

  describe('dependents management', () => {
    let request, anotherRequest

    beforeEach(() => {
      request = {}
      anotherRequest = {}
    })

    it('should track one dependent', () => {
      fetchResult.trackDependents(request)
      expect(fetchResult.isInUse()).to.be.true
    })

    it('should remove one dependent', () => {
      fetchResult.trackDependents(request)
      fetchResult.removeDependents(request)
      expect(fetchResult.isInUse()).to.be.false
    })

    it('should track and remove two dependents', () => {
      fetchResult.trackDependents(request, anotherRequest)
      expect(fetchResult.isInUse()).to.be.true
      fetchResult.removeDependents(request, anotherRequest)
      expect(fetchResult.isInUse()).to.be.false
    })

    it('should track and remove two dependents sequentially', () => {
      fetchResult.trackDependents(request, anotherRequest)
      expect(fetchResult.isInUse()).to.be.true
      fetchResult.removeDependents(request)
      expect(fetchResult.isInUse()).to.be.true
      fetchResult.removeDependents(anotherRequest)
      expect(fetchResult.isInUse()).to.be.false
    })
  })

  describe('decorate', () => {
    it('should decorate a request', () => {
      const request = { trackCleanup: sinon.stub() }
      fetchResult.decorate(request)

      expect(request.contentOrigin).to.be.equal('origin')
      expect(fetchResult.isInUse()).to.be.true
      expect(request.trackCleanup.calledOnce).to.be.true
    })

    it('should track a request and remove a request upon done', () => {
      const request = new Request('test', 'http://test')
      fetchResult.decorate(request)
      expect(fetchResult.isInUse()).to.be.true
      expect(request.getTrackedCleanups().length).to.be.equal(1)

      request.getTrackedCleanups()[0]()
      expect(fetchResult.isInUse()).to.be.false
    })
  })
})