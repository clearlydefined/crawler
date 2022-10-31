// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const sinon = require('sinon')
const Request = require('../../../../ghcrawler/lib/request.js')
const StorageBackedInMemoryQueue = require('../../../../ghcrawler/providers/queuing/storageBackedInMemoryQueue')

chai.use(chaiAsPromised)
const expect = chai.expect

describe('storageBackedInMemoryQueue', () => {
  let memoryQueueStub, storageQueueStub, testQueue

  const createTestQueue = (memoryQueue, storageQueueStub) => {
    const options = {
      logger: {
        verbose: sinon.stub()
      }
    }
    return new StorageBackedInMemoryQueue(memoryQueue, storageQueueStub, options)
  }

  describe('subscription', async () => {

    it('should subscribe', async () => {
      memoryQueueStub = { subscribe: sinon.stub() }
      storageQueueStub = { subscribe: sinon.stub() }
      testQueue = createTestQueue(memoryQueueStub, storageQueueStub)
      await testQueue.subscribe()

      expect(memoryQueueStub.subscribe.calledOnce).to.be.true
      expect(storageQueueStub.subscribe.calledOnce).to.be.true
    })

    it('should unsubscribe', async () => {
      memoryQueueStub = { unsubscribe: sinon.stub() }
      const storageQueueStub = { unsubscribe: sinon.stub() }
      const testQueue = createTestQueue(memoryQueueStub, storageQueueStub)
      await testQueue.unsubscribe()

      expect(memoryQueueStub.unsubscribe.calledOnce).to.be.true
      expect(storageQueueStub.unsubscribe.calledOnce).to.be.true
    })
  })

  describe('push', async () => {

    beforeEach(() => {
      memoryQueueStub = { push: sinon.stub().resolves() }
      storageQueueStub = { push: sinon.stub().resolves([]) }
      testQueue = createTestQueue(memoryQueueStub, storageQueueStub)
    })

    it('should push one request', async () => {
      const request = new Request('test', 'http://test')
      await testQueue.push(request)

      expect(memoryQueueStub.push.calledOnce).to.be.true
      expect(storageQueueStub.push.calledOnce).to.be.true
    })

    it('should push request arrays', async () => {
      const request = new Request('test', 'http://test')
      await testQueue.push([request, request])

      expect(memoryQueueStub.push.calledOnce).to.be.true
      expect(storageQueueStub.push.calledOnce).to.be.true
    })
  })

  describe('pop', async () => {

    beforeEach(() => {
      memoryQueueStub = { pop: sinon.stub() }
      storageQueueStub = {
        updateVisibilityTimeout: sinon.stub(),
        isMessageNotFound: sinon.stub()
      }
      testQueue = createTestQueue(memoryQueueStub, storageQueueStub)
    })

    it('should be able pop empty', async () => {
      memoryQueueStub.pop.resolves(undefined)
      const popped = await testQueue.pop()

      expect(memoryQueueStub.pop.calledOnce).to.be.true
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

    beforeEach(() => {
      memoryQueueStub = { done: sinon.stub().resolves() }
      storageQueueStub = {
        done: sinon.stub(),
        isMessageNotFound: sinon.stub()
      }
      testQueue = createTestQueue(memoryQueueStub, storageQueueStub)
    })

    it('should call done on a request', async () => {
      storageQueueStub.done.resolves()

      const request = new Request('test', 'http://test')
      await expect(testQueue.done(request)).to.be.fulfilled

      expect(memoryQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.isMessageNotFound.called).to.be.false
    })

    it('should be ok when storage throws a message not found exception', async () => {
      storageQueueStub.done.rejects(new Error('MessageNotFound'))
      storageQueueStub.isMessageNotFound.returns(true)

      const request = new Request('test', 'http://test')
      await expect(testQueue.done(request)).to.be.fulfilled

      expect(memoryQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.isMessageNotFound.called).to.be.true
    })

    it('should throw when storage throws exception', async () => {
      storageQueueStub.done.rejects(new Error('test'))
      storageQueueStub.isMessageNotFound.returns(false)

      const request = new Request('test', 'http://test')
      await expect(testQueue.done(request)).to.be.rejectedWith('test')

      expect(memoryQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.isMessageNotFound.called).to.be.true
    })
  })

  describe('flush', async () => {

    beforeEach(() => {
      memoryQueueStub = {
        getInfo: sinon.stub(),
        pop: sinon.stub().resolves(new Request('test', 'http://test')),
        done: sinon.stub().resolves()
      }
      storageQueueStub = {
        updateVisibilityTimeout: sinon.stub(),
        done: sinon.stub(),
        isMessageNotFound: sinon.stub()
      }
      testQueue = createTestQueue(memoryQueueStub, storageQueueStub)
    })

    it('should flush with one request in queue', async () => {
      memoryQueueStub.getInfo.resolves({count: 1})
      memoryQueueStub.pop.resolves(new Request('test', 'http://test')),
      storageQueueStub.updateVisibilityTimeout.resolves({})
      storageQueueStub.done.resolves()

      await expect(testQueue.flush()).to.be.fulfilled
      expect(memoryQueueStub.pop.calledOnce).to.be.true
      expect(storageQueueStub.updateVisibilityTimeout.calledOnce).to.be.true
      expect(memoryQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.isMessageNotFound.called).to.be.false
    })

    it('should handle ok when storage update visibility fails with message not found', async () => {
      memoryQueueStub.getInfo.resolves({ count: 1 })
      memoryQueueStub.pop
        .onFirstCall()
        .resolves(new Request('test', 'http://test'))
        .onSecondCall()
        .resolves(undefined)
      storageQueueStub.updateVisibilityTimeout.rejects(new Error('MessageNotFound'))
      storageQueueStub.isMessageNotFound.returns(true)

      await expect(testQueue.flush()).to.be.fulfilled
      expect(memoryQueueStub.pop.calledTwice).to.be.true
      expect(storageQueueStub.updateVisibilityTimeout.calledOnce).to.be.true
      expect(storageQueueStub.isMessageNotFound.calledOnce).to.be.true
      expect(memoryQueueStub.done.called).to.be.false
      expect(storageQueueStub.done.called).to.be.false
    })

    it('should handle ok when storage queue delete fails with message not found', async () => {
      memoryQueueStub.getInfo.resolves({ count: 1 })
      memoryQueueStub.pop.resolves(new Request('test', 'http://test'))
      storageQueueStub.updateVisibilityTimeout.resolves({})
      storageQueueStub.done.rejects(new Error('MessageNotFound'))
      storageQueueStub.isMessageNotFound.returns(true)

      await expect(testQueue.flush()).to.be.fulfilled
      expect(memoryQueueStub.pop.calledOnce).to.be.true
      expect(storageQueueStub.updateVisibilityTimeout.calledOnce).to.be.true
      expect(memoryQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.done.calledOnce).to.be.true
      expect(storageQueueStub.isMessageNotFound.calledOnce).to.be.true
    })

    it('should reject on other exceptions', async () => {
      memoryQueueStub.getInfo.resolves({ count: 1 })
      memoryQueueStub.pop.resolves(new Request('test', 'http://test'))
      storageQueueStub.updateVisibilityTimeout.rejects(new Error('test'))
      storageQueueStub.isMessageNotFound.returns(false)

      await expect(testQueue.flush()).to.be.rejectedWith('test')
      expect(memoryQueueStub.pop.calledOnce).to.be.true
      expect(storageQueueStub.updateVisibilityTimeout.calledOnce).to.be.true
    })

    it('should reject when one failed and the other is success. ', async () => {
      memoryQueueStub.getInfo.resolves({ count: 2 })
      memoryQueueStub.pop
      .onFirstCall()
      .resolves(new Request('test1', 'http://test'))
      .onSecondCall()
      .resolves(new Request('test2', 'http://test'))
      storageQueueStub.updateVisibilityTimeout.resolves({})
      storageQueueStub.done
        .onFirstCall()
        .rejects(new Error('test'))
        .onSecondCall()
        .resolves()
      storageQueueStub.isMessageNotFound.returns(false)

      await expect(testQueue.flush()).to.be.rejectedWith('test')
      expect(memoryQueueStub.pop.calledTwice).to.be.true
      expect(storageQueueStub.updateVisibilityTimeout.calledTwice).to.be.true
      expect(memoryQueueStub.done.calledTwice).to.be.true
      expect(storageQueueStub.done.calledTwice).to.be.true
      expect(storageQueueStub.isMessageNotFound.calledOnce).to.be.true
    })
  })
})

