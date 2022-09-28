// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const Request = require('../../../../ghcrawler').request
const debianExtract = require('../../../../providers/process/debExtract')

describe('Debian processing', () => {
  it('processes a simple Debian correctly', async () => {
    const { processor, request } = await setup()
    processor.linkAndQueue = sinon.stub()
    await processor.handle(request)

    expect(request.document.sourceInfo.type).to.equal('debsrc')
    expect(processor.linkAndQueueTool.callCount).to.be.equal(3)
    expect(processor.linkAndQueueTool.args.map(call => call[1])).to.have.members([
      'licensee',
      'scancode',
      'reuse' /*, 'fossology'*/
    ])
    expect(processor.linkAndQueue.callCount).to.be.equal(1)
    expect(processor.linkAndQueue.args[0][1]).to.equal('source')
    expect(processor.linkAndQueue.args[0][2].toUrl()).to.equal('cd:/debsrc/debian/-/0ad/0.0.17-1')
  })
})

async function setup() {
  const processor = debianExtract({ logger: { info: () => { } } }, () => { })
  processor.linkAndQueueTool = sinon.stub()
  const request = createRequest()
  const dir = processor.createTempDir(request)
  request.document.location = dir.name
  return { processor, request }
}

function createRequest() {
  const request = new Request('deb', 'cd:/deb/debian/-/0ad/0.0.17-1_armhf')
  request.document = {
    _metadata: { links: {} },
    sourceInfo: {
      type: 'debsrc',
      provider: 'debian',
      namespace: '-',
      name: '0ad',
      revision: '0.0.17-1'
    },
    registryData: [{ Architecture: 'armhf', Source: '0ad' }]
  }
  request.processMode = 'process'
  return request
}
