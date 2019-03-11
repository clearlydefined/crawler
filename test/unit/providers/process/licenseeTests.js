// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const fs = require('fs')
const path = require('path')
const { request } = require('ghcrawler')

let Handler

describe('Licensee process', () => {
  it('should handle a mess of cases', async () => {
    const { request, processor } = setup('9.10.1/folder1')
    await processor.handle(request)
    const { document } = request
    expect(document.licensee.output.content.matched_files.length).to.equal(4)
    expect(processor.attachFiles.args[0][1]).to.have.members([
      'LICENSE',
      'package.json',
      'subfolder/LICENSE.foo',
      'subfolder/LICENSE.bar'
    ])
    expect(processor.attachFiles.args[0][2]).to.equal(path.resolve('test/fixtures/licensee/9.10.1/folder1'))
  })

  it('should handle empty matched files list', async () => {
    const { request, processor } = setup('9.10.1/folder2')
    await processor.handle(request)
    const { document } = request
    expect(document.licensee.version).to.equal('1.2.0')
    expect(document.licensee.output.content.matched_files.length).to.equal(0)
    expect(processor.attachFiles.args[0][1].length).to.equal(0)
  })

  it('should exec error', async () => {
    const { request, processor } = setup('9.10.1/folder2', new Error('test error'))
    await processor.handle(request)
    expect(request.message).to.equal('test error')
    expect(request.outcome).to.equal('Error')
    expect(request.processControl).to.equal('skip')
    expect(request.crawler.storeDeadletter.calledOnce).to.be.true
  })

  it('should skip if Licensee not found', async () => {
    const { request, processor } = setup(null, null, new Error('licensee error message here'))
    await processor.handle(request)
    expect(request.processControl).to.equal('skip')
  })

  beforeEach(function() {
    const resultBox = { error: null, versionResult: '1.2.0', versionError: null }
    const processStub = {
      exec: (command, bufferLength, callback) => {
        if (command.includes('version')) return callback(resultBox.versionError, resultBox.versionResult)
        const path = command.split(' ').slice(-1)
        callback(resultBox.error, fs.readFileSync(`${path}/output.json`))
      }
    }
    Handler = proxyquire('../../../../providers/process/licensee', { child_process: processStub })
    Handler._resultBox = resultBox
  })

  afterEach(function() {
    sandbox.restore()
  })
})

function setup(fixture, error, versionError) {
  const options = { logger: { log: sinon.stub() } }
  const testRequest = new request('npm', 'cd:/npm/npmjs/-/test/1.1')
  testRequest.document = { _metadata: { links: {} }, location: path.resolve(`test/fixtures/licensee/${fixture}`) }
  testRequest.crawler = { storeDeadletter: sinon.stub() }
  Handler._resultBox.error = error
  Handler._resultBox.versionError = versionError
  const processor = Handler(options)
  processor.attachFiles = sinon.stub()
  return { request: testRequest, processor }
}
