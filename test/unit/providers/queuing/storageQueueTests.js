const sinon = require('sinon')
const { expect } = require('chai')
const StorageQueue = require('../../../../ghcrawler/providers/queuing/storageQueue')

describe('StorageQueue', () => {
  let queue, clientStub

  beforeEach(() => {
    clientStub = {
      createMessage: sinon.stub().yields(null, {})
    }
    queue = new StorageQueue(clientStub, 'testQueue', 'testQueueName', message => message, { messageTimeToLive: 3600 }) // 1 hour expiration
  })

  it('should add messages with the correct expiration', async () => {
    await queue.push({ body: 'test message' })

    expect(clientStub.createMessage.calledOnce).to.be.true
    const args = clientStub.createMessage.getCall(0).args
    expect(args[2].messageTimeToLive).to.equal(3600)
  })
})