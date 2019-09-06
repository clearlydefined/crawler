// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const Request = require('ghcrawler').request
const debianExtract = require('../../../../providers/process/debExtract')

describe('Debian processing', () => {
  it('processes a simple Debian correctly', async () => {
    const { processor, request } = await setup()
    processor.linkAndQueue = sinon.stub()
    processor.isProcessing = () => false
    await processor.handle(request)

    expect(request.document).to.be.not.null
    expect(processor.linkAndQueueTool.callCount).to.be.equal(2)
    expect(processor.linkAndQueueTool.args.map(call => call[1])).to.have.members([
      'licensee',
      'scancode' /*, 'fossology'*/
    ])
    expect(processor.linkAndQueue.callCount).to.be.equal(1)
    expect(processor.linkAndQueue.args[0][1]).to.equal('source')
    expect(processor.linkAndQueue.args[0][2].toUrl()).to.equal('cd:/debsrc/deb/-/0ad/0.0.17-1')
  })
})

async function setup() {
  const processor = debianExtract({ logger: { info: () => {} } }, () => {})
  processor.linkAndQueueTool = sinon.stub()
  const request = createRequest()
  return { processor, request }
}

function createRequest() {
  const request = new Request('deb', 'cd:/debsrc/debian/-/0ad/0.0.17-1_armhf')
  request.document = {
    _metadata: { links: {} },
    sourceInfo: {
      type: 'debsrc',
      provider: 'deb',
      namespace: '-',
      name: '0ad',
      revision: '0.0.17-1'
    }
  }
  request.processMode = 'process'
  return request
}
