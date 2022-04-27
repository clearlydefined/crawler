// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect, should } = require('chai')
const sinon = require('sinon')
const Request = require('../../../ghcrawler/lib/request.js')
const ScopedQueueSets = require('../../../ghcrawler/providers/queuing/scopedQueueSets.js')
const AttenuatedQueue = require('../../../ghcrawler/providers/queuing/attenuatedQueue')
const InMemoryCrawlQueue = require('../../../ghcrawler/providers/queuing/inmemorycrawlqueue')
const QueueSet = require('../../../ghcrawler/providers/queuing/queueSet.js')

describe('scopedQueueSets', () => {

  describe('subscription management', () => {
    let scopedQueues
    let globalQueues
    let localQueues

    function createQueues() {
      return {
        subscribe: sinon.stub(),
        unsubscribe: sinon.stub()
      }
    }

    beforeEach(() => {
      globalQueues = createQueues()
      localQueues = createQueues()
      scopedQueues = new ScopedQueueSets(globalQueues, localQueues)
    })

    it('should subscribe all', async () => {
      await scopedQueues.subscribe()
      expect(globalQueues.subscribe.calledOnce)
      expect(localQueues.subscribe.calledOnce)
    })

    it('should unsubscribe all', async () => {
      await scopedQueues.unsubscribe()
      expect(globalQueues.unsubscribe.calledOnce)
      expect(localQueues.unsubscribe.calledOnce)
    })
  })

  describe('originQueue management', () => {
    let scopedQueues

    beforeEach(() => {
      scopedQueues = new ScopedQueueSets({}, {})
    })

    it('should call done and mark acked on done', async () => {
      const queue = { done: sinon.stub() }
      const request = poppedRequest(queue)

      await scopedQueues.done(request)

      expect(request.acked).to.be.true
      expect(queue.done.callCount).to.be.equal(1)
      expect(queue.done.getCall(0).args[0].type).to.be.equal('test')
    })

    it('should call done and mark acked on abandon', async () => {
      const queue = { abandon: sinon.stub() }
      const request = poppedRequest(queue)

      await scopedQueues.abandon(request)

      expect(request.acked).to.be.true
      expect(queue.abandon.callCount).to.be.equal(1)
      expect(queue.abandon.getCall(0).args[0].type).to.be.equal('test')
    })

    it('should not abandon twice', async () => {
      const queue = { abandon: sinon.stub() }
      const request = poppedRequest(queue)

      await scopedQueues.abandon(request)
      await scopedQueues.abandon(request)

      expect(request.acked).to.be.true
      expect(queue.abandon.callCount).to.be.equal(1)
      expect(queue.abandon.getCall(0).args[0].type).to.be.equal('test')
    })

    it('should not done after abandon ', async () => {
      const queue = { abandon: sinon.stub(), done: sinon.stub() }
      const request = poppedRequest(queue)

      await scopedQueues.abandon(request)
      await scopedQueues.done(request)

      expect(request.acked).to.be.true
      expect(queue.done.callCount).to.be.equal(0)
      expect(queue.abandon.callCount).to.be.equal(1)
      expect(queue.abandon.getCall(0).args[0].type).to.be.equal('test')
    })
  })

  describe('getQueue', () => {
    let scopedQueues
    let globalQueues
    let localQueues

    beforeEach(() => {
      globalQueues = { getQueue: sinon.stub() }
      localQueues = { getQueue: sinon.stub() }
      scopedQueues = new ScopedQueueSets(globalQueues, localQueues)
    })

    it('get global queue', async () => {
      scopedQueues.getQueue('test', 'global')
      expect(globalQueues.getQueue.calledOnce)
      expect(globalQueues.getQueue.getCall(0).args[0]).to.be.equal('test')
      expect(localQueues.getQueue.callCount).to.be.equal(0)
    })

    it('get local queue', async () => {
      scopedQueues.getQueue('test', 'local')
      expect(localQueues.getQueue.calledOnce)
      expect(localQueues.getQueue.getCall(0).args[0]).to.be.equal('test')
      expect(globalQueues.getQueue.callCount).to.be.equal(0)
    })
  })

  describe('pop', () => {
    let scopedQueues
    let globalQueues
    let localQueues

    function mockPopReturn(fromQueue) {
      const queue = {
        getName: sinon.stub().returns(fromQueue)
      }
      return poppedRequest(queue)
    }

    beforeEach(() => {
      globalQueues = { pop: sinon.stub().resolves(mockPopReturn('global')) }
      localQueues = { pop: sinon.stub() }
      scopedQueues = new ScopedQueueSets(globalQueues, localQueues)
    })

    it('pop local, set retry queue', async () => {
      localQueues.pop.resolves(mockPopReturn('local'))

      const poped = await scopedQueues.pop()

      expect(poped._retryQueue).to.be.equal('local')
      expect(localQueues.pop.calledOnce)
      expect(globalQueues.pop.callCount).to.be.equal(0)
    })

    it('pop global', async () => {
      localQueues.pop.resolves(undefined)

      const poped = await scopedQueues.pop()

      expect(poped._originQueue.getName()).to.be.equal('global')
      expect(poped._retryQueue).to.be.undefined
      expect(localQueues.pop.calledOnce)
      expect(globalQueues.pop.calledOnce)
    })
  })

  describe('repush', () => {
    let scopedQueues
    let globalQueues, globalQueue, localQueues, localQueue

    beforeEach(() => {
      globalQueue = mockQueue('normal')
      globalQueues = {
        getQueue: sinon.stub().returns(globalQueue),
        pop: sinon.stub().resolves(poppedRequest(globalQueue))
      }
      localQueue = mockQueue('normal')
      localQueues = {
        pop: sinon.stub()
      }
      scopedQueues = new ScopedQueueSets(globalQueues, localQueues)
    })

    it('should repush local request to global scope', async () => {
      localQueues.pop.resolves(poppedRequest(localQueue))

      const request = await scopedQueues.pop()
      await scopedQueues.repush(request, request)

      expect(localQueue.done.calledOnce).to.be.true
      expect(globalQueue.push.calledOnce).to.be.true
      expect(globalQueue.push.getCall(0).args[0].type).to.be.equal('test')
    })

    it('should repush global request into the same queue', async () => {
      localQueues.pop.resolves()

      const request = await scopedQueues.pop()
      await scopedQueues.repush(request, request)

      expect(localQueue.done.callCount).to.be.equal(0)
      expect(request._originQueue === globalQueue).to.be.true
      expect(globalQueue.push.calledOnce).to.be.true
      expect(globalQueue.push.getCall(0).args[0].type).to.be.equal('test')
    })
  })

  describe('publish', () => {
    let scopedQueues
    let globalQueues, globalQueue, localQueues, localQueue

    beforeEach(() => {
      globalQueue = mockQueue('normal')
      globalQueues = {
        getQueue: () => globalQueue
      }
      localQueue = mockQueue('normal')
      localQueue.pop.resolves(poppedRequest(localQueue))
      localQueues = {
        queues: [localQueue]
      }

      scopedQueues = new ScopedQueueSets(globalQueues, localQueues)
    })

    it('skip update empty local queues', async () => {
      localQueue.getInfo = sinon.stub().resolves({ count: 0 })

      await scopedQueues.publish()

      expect(localQueue.pop.callCount).to.be.equal(0)
      expect(globalQueue.push.callCount).to.be.equal(0)
    })

    it('success', async () => {
      localQueue.getInfo = sinon.stub().resolves({ count: 1 })

      await scopedQueues.publish()

      expect(localQueue.pop.calledOnce).to.be.true
      expect(localQueue.done.calledOnce).to.be.true
      expect(globalQueue.push.calledOnce).to.be.true
      expect(globalQueue.push.getCall(0).args[0].type).to.be.equal('test')
    })

    it('success with 2 items', async () => {
      localQueue.getInfo = sinon.stub().resolves({ count: 2 })

      await scopedQueues.publish()

      expect(localQueue.pop.callCount).to.be.equal(2)
      expect(localQueue.done.callCount).to.be.equal(2)
      expect(globalQueue.push.callCount).to.be.equal(2)
      expect(globalQueue.push.getCall(0).args[0].type).to.be.equal('test')
      expect(globalQueue.push.getCall(1).args[0].type).to.be.equal('test')
    })

    it('partial success', async () => {
      const failQueue = mockQueue('failing')
      failQueue.getInfo = sinon.stub().rejects('failed')
      localQueue.getInfo = sinon.stub().resolves({ count: 1 })
      localQueues.queues = [failQueue, localQueue]

      try {
        await scopedQueues.publish()
        should.fail()
      } catch (error) {
        expect(error.message).to.be.equal('failed')
      }

      //The remaining queue is still processed.
      expect(localQueue.done.calledOnce).to.be.true
      expect(globalQueue.push.calledOnce).to.be.true
      expect(globalQueue.push.getCall(0).args[0].type).to.be.equal('test')
    })
  })
})

describe('integration test with AttenuatedQueue and InMemoryCrawlQueue', () => {
  const queueName = 'queue'
  let scopedQueues

  beforeEach(() => {
    scopedQueues = createScopedQueueSets(queueName)
  })

  afterEach(async () => {
    await cleanup(scopedQueues, queueName)
  })

  it('add to global by default and pop', async () => {
    const mockRequest = new Request('test', 'http://test')
    await scopedQueues.push(mockRequest, queueName)
    let queueInfo = await getQueueInfos(scopedQueues, queueName)
    expect(queueInfo.global.count).to.be.equal(1)
    expect(queueInfo.local.count).to.be.equal(0)

    const popped = await scopedQueues.pop()
    expect(popped.type).to.be.equal('test')
    queueInfo = await getQueueInfos(scopedQueues, queueName)
    expect(queueInfo.global.count).to.be.equal(0)
    expect(queueInfo.local.count).to.be.equal(0)

    //ensure request is removed from the cache in the AttenuatedQueue
    await scopedQueues.done(popped)
  })

  it('add to local and pop', async () => {
    const mockRequest = new Request('test', 'http://test')
    await scopedQueues.push(mockRequest, queueName, 'local')
    let queueInfo = await getQueueInfos(scopedQueues, queueName)
    expect(queueInfo.global.count).to.be.equal(0)
    expect(queueInfo.local.count).to.be.equal(1)

    const popped = await scopedQueues.pop()
    expect(popped.type).to.be.equal('test')
    queueInfo = await getQueueInfos(scopedQueues, queueName)
    expect(queueInfo.global.count).to.be.equal(0)
    expect(queueInfo.local.count).to.be.equal(0)

    //ensure request is removed from the cache in the AttenuatedQueue
    await scopedQueues.done(popped)
  })

  it('add to global, local and pop', async () => {
    const mockRequestGlobal = new Request('testGlobal', 'http://test')
    const mockRequestLocal = new Request('testLocal', 'http://test')
    await scopedQueues.push(mockRequestGlobal, queueName)
    await scopedQueues.push(mockRequestLocal, queueName, 'local')
    let queueInfo = await getQueueInfos(scopedQueues, queueName)
    expect(queueInfo.global.count).to.be.equal(1)
    expect(queueInfo.local.count).to.be.equal(1)

    const popped = await scopedQueues.pop()
    expect(popped.type).to.be.equal('testLocal')
    queueInfo = await getQueueInfos(scopedQueues, queueName)
    expect(queueInfo.global.count).to.be.equal(1)
    expect(queueInfo.local.count).to.be.equal(0)

    //ensure request is removed from the cache in the AttenuatedQueue
    await scopedQueues.done(popped)
  })

  it('local repushed to global', async () => {
    const mockRequest = new Request('test', 'http://test')
    await scopedQueues.push(mockRequest, queueName, 'local')
    let queueInfo = await getQueueInfos(scopedQueues, queueName)
    expect(queueInfo.global.count).to.be.equal(0)
    expect(queueInfo.local.count).to.be.equal(1)

    const popped = await scopedQueues.pop()
    await scopedQueues.repush(popped, popped.createRequeuable())
    queueInfo = await getQueueInfos(scopedQueues, queueName)
    expect(queueInfo.global.count).to.be.equal(1)
    expect(queueInfo.local.count).to.be.equal(0)
  })

  it('publish local to global', async () => {
    const mockRequest = new Request('test', 'http://test')
    await scopedQueues.push(mockRequest, queueName, 'local')
    let queueInfo = await getQueueInfos(scopedQueues, queueName)
    expect(queueInfo.global.count).to.be.equal(0)
    expect(queueInfo.local.count).to.be.equal(1)

    await scopedQueues.publish()
    queueInfo = await getQueueInfos(scopedQueues, queueName)
    expect(queueInfo.global.count).to.be.equal(1)
    expect(queueInfo.local.count).to.be.equal(0)
  })

  it('publish two local requests to global', async () => {
    const globalRequest = new Request('testGlobal', 'http://test')
    const localRequest1 = new Request('testLocal-1', 'http://test')
    const localRequest2 = new Request('testLocal-2', 'http://test')
    await scopedQueues.push(globalRequest, queueName)
    await scopedQueues.push(localRequest1, queueName, 'local')
    await scopedQueues.push(localRequest2, queueName, 'local')
    let queueInfo = await getQueueInfos(scopedQueues, queueName)
    expect(queueInfo.global.count).to.be.equal(1)
    expect(queueInfo.local.count).to.be.equal(2)

    await scopedQueues.publish()
    queueInfo = await getQueueInfos(scopedQueues, queueName)
    expect(queueInfo.global.count).to.be.equal(3)
    expect(queueInfo.local.count).to.be.equal(0)
  })
})

function createScopedQueueSets(queueName) {
  const options = {
    _config: {
      on: sinon.stub()
    },
    logger: {
      verbose: sinon.stub()
    }
  }
  const global = new AttenuatedQueue(new InMemoryCrawlQueue(queueName, options), options)
  const local = new AttenuatedQueue(new InMemoryCrawlQueue(queueName, options), options)
  return new ScopedQueueSets(
    new QueueSet([global], options),
    new QueueSet([local], options))
}

async function getQueueInfos(scopedQueues, queueName) {
  let globalInfo = await scopedQueues.getQueue(queueName).getInfo()
  let localQueueInfo = await scopedQueues.getQueue(queueName, 'local').getInfo()
  return { global: globalInfo, local: localQueueInfo }
}

async function cleanup(scopedQueues, queueName) {
  //remove request from the cache inside the AttenuatedQueue
  let queueInfo = await getQueueInfos(scopedQueues, queueName)
  let count = queueInfo.global.count + queueInfo.local.count
  while (count) {
    const popped = await scopedQueues.pop()
    await scopedQueues.done(popped)
    count--
  }
}

function poppedRequest(fromQueue) {
  const request = new Request('test', 'http://test')
  request._originQueue = fromQueue
  return request
}

function mockQueue(fromQueue) {
  return {
    getName: sinon.stub().returns(fromQueue),
    push: sinon.stub().resolves(),
    done: sinon.stub().resolves(),
    pop: sinon.stub()
  }
}