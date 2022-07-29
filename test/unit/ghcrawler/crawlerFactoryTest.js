// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const CrawlerFactory = require('../../../ghcrawler/crawlerFactory')
const MemoryFactory = require('../../../ghcrawler/providers/queuing/memoryFactory')

describe('create scopedQueueSets', () => {

  before(() => {
    sinon.stub(CrawlerFactory, 'createQueues').callsFake((options, provider = options.provider) => {
      const opts = options[provider] || {}
      opts.logger = { info: sinon.stub() }
      return MemoryFactory(opts)
    })
  })

  after(() => {
    sinon.restore()
  })

  it('should create ok with memory queue options', async () => {
    const queueOptions = {
      provider: 'memory',
      memory: {
        _config: { on: sinon.stub() },
        weights: { immediate: 3, soon: 2, normal: 3, later: 2 },
      }
    }
    const queues = CrawlerFactory.createScopedQueueSets(queueOptions)
    expect(queues).to.be.ok
  })

  it('should create ok with non memory queue options', async () => {
    const queueOptions = {
      provider: 'storageQueue',
      storageQueue: {
        _config: { on: sinon.stub() },
        weights: { immediate: 3, soon: 2, normal: 3, later: 2 },
        queueName: 'cdcrawlerdev'
      }
    }
    const queues = CrawlerFactory.createScopedQueueSets(queueOptions)
    expect(queues).to.be.ok
  })
})
