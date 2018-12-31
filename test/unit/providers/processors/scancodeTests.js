// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const { request } = require('ghcrawler')

let Handler

describe('ScanCode process', () => {
  it('should handle gems', async () => {
    const { request, processor } = setup('2.9.8/gem.json')
    await processor.handle(request)
    expect(processor.attachFiles.args[0][1]).to.have.members([])
  })

  it('should handle simple npms', async () => {
    const { request, processor } = setup('2.9.8/npm-basic.json')
    await processor.handle(request)
    expect(processor.attachFiles.args[0][1]).to.have.members(['package/package.json'])
  })

  it('should handle large npms', async () => {
    const { request, processor } = setup('2.9.8/npm-large.json')
    await processor.handle(request)
    expect(processor.attachFiles.args[0][1]).to.have.members(['package/package.json'])
  })

  it('should skip if ScanCode not found', async () => {
    const { request, processor } = setup(null, null, new Error('error message here'))
    await processor.handle(request)
    expect(request.processControl).to.equal('skip')
  })

  beforeEach(function() {
    const resultBox = { error: null, versionResult: '1.2', versionError: null }
    const processStub = {
      exec: (command, bufferLength, callback) => {
        if (command.includes('version')) return callback(resultBox.versionError, resultBox.versionResult)
        callback(resultBox.error)
      }
    }
    Handler = proxyquire('../../../../providers/process/scancode', { child_process: processStub })
    Handler._resultBox = resultBox
  })

  afterEach(function() {
    sandbox.restore()
  })
})

function setup(fixture, error, versionError) {
  const options = {
    options: [],
    timeout: 200,
    processes: 2,
    format: 'json',
    logger: { log: sinon.stub(), info: sinon.stub() }
  }
  const testRequest = new request('npm', 'cd:/npm/npmjs/-/test/1.1')
  testRequest.document = { _metadata: { links: {} }, location: '/test' }
  Handler._resultBox.error = error
  Handler._resultBox.versionError = versionError
  const processor = Handler(options)
  processor.createTempFile = () => {
    return { name: `test/fixtures/scancode/${fixture}` }
  }
  processor._computeSize = () => {
    return { k: 13, count: 12 }
  }
  processor.attachFiles = sinon.stub()
  return { request: testRequest, processor }
}
