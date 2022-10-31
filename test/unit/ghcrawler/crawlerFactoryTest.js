// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const CrawlerFactory = require('../../../ghcrawler/crawlerFactory')
const MemoryFactory = require('../../../ghcrawler/providers/queuing/memoryFactory')

describe('create scopedQueueSets', () => {

  before(() => {
    sinon.stub(CrawlerFactory, '_getProvider').callsFake((options, provider = options.provider) => {
      const opts = options[provider] || {}
      opts.logger = { info: sinon.stub() }
      return MemoryFactory(opts)
    })
  })

  after(() => {
    sinon.restore()
  })

  it('should create with memory queue options', async () => {
    const queueOptions = {
      provider: 'memory',
      memory: {
        _config: { on: sinon.stub() },
        weights: { immediate: 3, soon: 2, normal: 3, later: 2 }
      }
    }
    const queues = CrawlerFactory.createQueues(queueOptions)
    expect(queues).to.be.ok
    expect(queueOptions.memory._config.on.calledTwice).to.be.true
  })

})
