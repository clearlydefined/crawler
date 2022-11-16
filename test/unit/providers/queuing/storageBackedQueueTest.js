// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const sinon = require('sinon')
const Request = require('../../../../ghcrawler/lib/request.js')
const StorageBackedQueue = require('../../../../ghcrawler/providers/queuing/storageBackedQueue')

chai.use(chaiAsPromised)
const expect = chai.expect

describe('storageBackedQueue', () => {
  let memoryQueueStub, storageQueueStub, testQueue

  const createTestQueue = (memoryQueue, storageQueue) => {
    const options = {
      logger: {
        verbose: sinon.stub()
      }
    }
    return new StorageBackedQueue(memoryQueue, storageQueue, options)
  }

  beforeEach(() => {
    memoryQueueStub = createQueueStub()
    storageQueueStub = createQueueStub()
    storageQueueStub.updateVisibilityTimeout = sinon.stub()
    storageQueueStub.isMessageNotFound = sinon.stub()
    testQueue = createTestQueue(memoryQueueStub, storageQueueStub)
  })

  describe('subscribe', async () => {

    beforeEach(() => {
      memoryQueueStub.subscribe.resolves()
      storageQueueStub.subscribe.resolves()
    })

    it('should subscribe', async () => {
      await testQueue.subscribe()
      expect(memoryQueueStub.subscribe.calledOnce).to.be.true
      expect(storageQueueStub.subscribe.calledOnce).to.be.true
    })

    it('should throw if subscribe fails', async () => {
      storageQueueStub.subscribe.rejects(new Error('test'))

      await expect(testQueue.subscribe()).to.be.rejected
      expect(memoryQueueStub.subscribe.calledOnce).to.be.true
      expect(storageQueueStub.subscribe.calledOnce).to.be.true
    })
  })


  describe('unsubscribe', async () => {
    beforeEach(() => {
      memoryQueueStub.unsubscribe.resolves()
      storageQueueStub.unsubscribe.resolves()
    })

    it('should unsubscribe', async () => {
      await testQueue.unsubscribe()

      expect(memoryQueueStub.unsubscribe.calledOnce).to.be.true
      expect(storageQueueStub.unsubscribe.calledOnce).to.be.true
    })

    it('should throw if unsubscribe fails', async () => {
      storageQueueStub.unsubscribe.rejects(new Error('test'))

      await expect(testQueue.unsubscribe()).to.be.rejected
      expect(memoryQueueStub.unsubscribe.calledOnce).to.be.true
      expect(storageQueueStub.unsubscribe.calledOnce).to.be.true
    })
  })

  describe('push', async () => {

    beforeEach(() => {
      memoryQueueStub.push.resolves()
      storageQueueStub.push.resolves([])
    })

    it('should push one request', async () => {
      const request = new Request('test', 'http://test')
      await testQueue.push(request)

      expect(memoryQueueStub.push.calledOnce).to.be.true
      expect(storageQueueStub.push.calledOnce).to.be.true
    })

    it('should push request arrays', async () => {
      const request1 = new Request('test1', 'http://test1')
      const request2 = new Request('test2', 'http://test2')
      await testQueue.push([request1, request2])

      expect(memoryQueueStub.push.calledOnce).to.be.true
      expect(storageQueueStub.push.calledOnce).to.be.true
    })
  })

  describe('pop', async () => {

    it('should be able pop empty', async () => {
      memoryQueueStub.pop.resolves(undefined)
      const popped = await testQueue.pop()

      expect(memoryQueueStub.pop.calledOnce).to.be.true
      expect(storageQueueStub.updateVisibilityTimeout.called).to.be.false
      expect(popped).not.to.be.ok
    })

    it('should pop request', async () => {
      memoryQueueStub.pop.resolves(new Request('test', 'http://test'))
      storageQueueStub.updateVisibilityTimeout.resolves({})
      const popped = await testQueue.pop()

      expect(memoryQueueStub.pop.calledOnce).to.be.true
      expect(storageQueueStub.updateVisibilityTimeout.calledOnce).to.be.true
      expect(popped).to.be.ok
    })

    it('should ignore stale request and pop next', async () => {
      memoryQueueStub.pop
        .onFirstCall()
        .resolves(new Request('test1', 'http://test1'))
        .onSecondCall()
        .resolves(new Request('test2', 'http://test2'))
      storageQueueStub.updateVisibilityTimeout
        .onFirstCall()
        .rejects(new Error('MessageNotFound'))
        .onSecondCall()
        .resolves({})
      storageQueueStub.isMessageNotFound.returns(true)

      const popped = await testQueue.pop()
      expect(memoryQueueStub.pop.calledTwice).to.be.true
      expect(storageQueueStub.updateVisibilityTimeout.calledTwice).to.be.true
      expect(storageQueueStub.isMessageNotFound.calledOnce).to.be.true
      expect(popped.type).to.be.equal('test2')
    })

    it('should throw if storage queue throws ', async () => {
      memoryQueueStub.pop.resolves(new Request('test', 'http://test'))
      storageQueueStub.updateVisibilityTimeout.rejects(new Error('test'))
      storageQueueStub.isMessageNotFound.returns(false)

      await expect(testQueue.pop()).to.be.rejectedWith('test')
    })
  })

  describe('done', async () => {
    let request

    beforeEach(() => {
      memoryQueueStub.done.resolves()
      request = new Request('test', 'http://test')
    })

    it('should call done on a request', async () => {
      storageQueueStub.done.resolves()

      await expect(testQueue.done(request)).to.be.fulfilled
      expect(memoryQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.isMessageNotFound.called).to.be.false
    })

    it('should be ok when storage throws a message not found exception', async () => {
      storageQueueStub.done.rejects(new Error('MessageNotFound'))
      storageQueueStub.isMessageNotFound.returns(true)

      await expect(testQueue.done(request)).to.be.fulfilled
      expect(memoryQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.isMessageNotFound.called).to.be.true
    })

    it('should throw when storage throws exception', async () => {
      storageQueueStub.done.rejects(new Error('test'))
      storageQueueStub.isMessageNotFound.returns(false)

      await expect(testQueue.done(request)).to.be.rejectedWith('test')
      expect(memoryQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.isMessageNotFound.called).to.be.true
    })
  })

  describe('flush', async () => {

    beforeEach(() => {
      memoryQueueStub.getInfo.resolves({count: 1})
      memoryQueueStub.pop.resolves(new Request('test', 'http://test'))
      memoryQueueStub.done.resolves()
      storageQueueStub.updateVisibilityTimeout.rejects('should not be called')
    })

    it('should flush with one request in queue', async () => {
      storageQueueStub.done.resolves()

      await expect(testQueue.flush()).to.be.fulfilled
      expect(memoryQueueStub.pop.calledOnce).to.be.true
      expect(memoryQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.isMessageNotFound.called).to.be.false
    })

    it('should handle ok when storage queue delete fails with message not found', async () => {
      storageQueueStub.done.rejects(new Error('MessageNotFound'))
      storageQueueStub.isMessageNotFound.returns(true)

      await expect(testQueue.flush()).to.be.fulfilled
      expect(memoryQueueStub.pop.calledOnce).to.be.true
      expect(memoryQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.isMessageNotFound.calledOnce).to.be.true
    })

    it('should reject on other exceptions', async () => {
      storageQueueStub.done.rejects(new Error('test'))
      storageQueueStub.isMessageNotFound.returns(false)

      await expect(testQueue.flush()).to.be.rejectedWith('Failed to flush')
      expect(memoryQueueStub.pop.calledOnce).to.be.true
    })

    it('should reject when one failed and the other is success. ', async () => {
      memoryQueueStub.getInfo.resolves({ count: 2 })
      memoryQueueStub.pop
        .onFirstCall()
        .resolves(new Request('test1', 'http://test'))
        .onSecondCall()
        .resolves(new Request('test2', 'http://test'))
      storageQueueStub.done
        .onFirstCall()
        .rejects(new Error('test'))
        .onSecondCall()
        .resolves()
      storageQueueStub.isMessageNotFound.returns(false)

      await expect(testQueue.flush()).to.be.rejectedWith('Failed to flush')
      expect(memoryQueueStub.pop.calledTwice).to.be.true
      expect(memoryQueueStub.done.calledTwice).to.be.true
      expect(storageQueueStub.done.calledTwice).to.be.true
      expect(storageQueueStub.isMessageNotFound.calledOnce).to.be.true
    })
  })
})

const createQueueStub = () => ({
  subscribe: sinon.stub(),
  unsubscribe: sinon.stub(),
  push: sinon.stub(),
  pop: sinon.stub(),
  done: sinon.stub(),
  getInfo: sinon.stub()
})
