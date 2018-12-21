// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const fs = require('fs')
const { request } = require('ghcrawler')
const BaseHandler = require('../../../../lib/baseHandler')

let Handler

describe('Licensee process', () => {
  it('should handle a mess of cases', async () => {
    const { request, processor } = setup('output1.json')
    await processor.handle(request)
    const { document } = request
    expect(document.licensee.output.content.length).to.equal(5)
    expect(BaseHandler.attachFiles.args[0][1]).to.have.members(['LICENSE', 'folder/LICENSE.foo'])
  })

  beforeEach(function() {
    const resultBox = { result: null, error: null, version: '1.2' }
    const processStub = {
      exec: (command, bufferLength, callback) =>
        callback(resultBox.error, command.includes('version') ? resultBox.version : resultBox.result)
    }
    Handler = proxyquire('../../../../providers/process/licensee', { child_process: processStub })
    Handler._resultBox = resultBox
    BaseHandler.attachFiles = sinon.stub()
  })

  afterEach(function() {
    sandbox.restore()
  })
})

function setup(fixture, error) {
  const options = { logger: sinon.stub() }
  const testRequest = new request('npm', 'cd://npm/npmjs/-/test/1.1')
  testRequest.document = { _metadata: { links: {} }, location: '/' }
  Handler._resultBox.error = error
  Handler._resultBox.result = fixture ? fs.readFileSync(`test/fixtures/licensee/${fixture}`, 'utf8') : null
  const processor = Handler(options)
  return { request: testRequest, processor }
}
