// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const Request = require('../../../../ghcrawler').request
const rpmExtract = require('../../../../providers/process/rpmExtract')

describe('RPM processing', () => {
  it('processes a simple RPM correctly', async () => {
    const { processor, request } = await setup()
    processor.linkAndQueue = sinon.stub()
    await processor.handle(request)

    expect(request.document.sourceInfo.type).to.equal('rpm')
    expect(processor.linkAndQueueTool.callCount).to.be.equal(3)
    expect(processor.linkAndQueueTool.args.map(call => call[1])).to.have.members([
      'licensee',
      'scancode',
      'reuse' /*, 'fossology'*/
    ])
    expect(processor.linkAndQueue.callCount).to.be.equal(1)
    expect(processor.linkAndQueue.args[0][1]).to.equal('rpm')
    expect(processor.linkAndQueue.args[0][2].toUrl()).to.equal('cd:/rpm/mariner/-/tini/0.19.0-7.cm2.src')
  })
})

async function setup() {
  const processor = rpmExtract({ logger: { info: () => { } } }, () => { })
  processor.linkAndQueueTool = sinon.stub()
  const request = createRequest()
  const dir = processor.createTempDir(request)
  request.document.location = dir.name
  return { processor, request }
}

function createRequest() {
  const request = new Request('rpm', 'cd:/rpm/mariner/-/tini/0.19.0-7.cm2.x86_64')
  request.document = {
    _metadata: { links: {} },
    registryData: { "rpm_sourcerpm": "tini-0.19.0-7.cm2.src.rpm" }
  }
  request.processMode = 'process'
  return request
}
