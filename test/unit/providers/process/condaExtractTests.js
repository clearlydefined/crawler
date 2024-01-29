// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const Request = require('../../../../ghcrawler').request
const CondaExtract = require('../../../../providers/process/condaExtract')

describe('Conda processing', () => {
  it('processes a simple Conda package correctly', async () => {
    const { processor, request } = await setup()
    processor.linkAndQueue = sinon.stub()
    processor.sourceFinder = () => {
      return { type: 'git', provider: 'github', namespace: '-', name: '21cmfast', revision: 'v3.0.2' }
    }
    await processor.handle(request)

    expect(processor.linkAndQueueTool.callCount).to.be.equal(3)
    expect(processor.linkAndQueueTool.args.map((call) => call[1])).to.have.members([
      'licensee',
      'scancode',
      'reuse' /*, 'fossology'*/,
    ])
    expect(processor.linkAndQueue.callCount).to.be.equal(1)
    expect(processor.linkAndQueue.args[0][1]).to.equal('source')
    expect(processor.linkAndQueue.args[0][2].toUrl()).to.equal('cd:/git/github/-/21cmfast/v3.0.2')
  })
})

async function setup() {
  const processor = CondaExtract({ logger: { info: () => {} } }, () => {})
  processor.linkAndQueueTool = sinon.stub()
  const request = createRequest()
  const dir = processor.createTempDir(request)
  request.document.location = dir.name
  return { processor, request }
}

function createRequest() {
  const request = new Request('conda', 'cd:/conda/conda-forge/-/21cmfast/linux-64--3.0.2')
  request.document = {
    _metadata: { links: {} },
    sourceInfo: {
      type: 'conda',
      provider: 'conda-forge',
      namespace: '-',
      name: '21cmfast',
      revision: 'linux-64--3.0.2',
    },
    registryData: {
      downloadUrl: '21cmfast',
      channelData: {},
      repoData: {
        packageData: {
          version: '3.0.2',
        },
      },
    },
  }
  request.processMode = 'process'
  return request
}
