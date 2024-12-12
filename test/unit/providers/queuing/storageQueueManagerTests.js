const sinon = require('sinon')
const { expect } = require('chai')
const StorageQueueManager = require('../../../../providers/queuing/storageQueueManager')
const StorageQueue = require('../../../../providers/queuing/storageQueue')

describe('StorageQueueManager', () => {
  let manager, clientStub

  beforeEach(() => {
    clientStub = {
      createMessage: sinon.stub().yields(null, {})
    }
    manager = new StorageQueueManager('connectionString', { expiration: 3600 }) // 1 hour expiration
    manager.client = clientStub
  })

  it('should create a queue with the correct expiration', async () => {
    const queue = manager.createQueue('testQueue')
    await queue.push({ body: 'test message' })

    expect(clientStub.createMessage.calledOnce).to.be.true
    const args = clientStub.createMessage.getCall(0).args
    expect(args[2].messageTimeToLive).to.equal(3600)
  })
})