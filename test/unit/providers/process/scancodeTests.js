// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const { request } = require('../../../../ghcrawler')
const { flatten } = require('lodash')

let Handler

describe('ScanCode misc', () => {
  it('differentiates real errors', () => {
    Handler._resultBox.result = {
      files: [{ scan_errors: ['ValueError: this is a test'] }, { scan_errors: ['bogus package.json'] }]
    }
    expect(Handler._hasRealErrors()).to.be.false
    Handler._resultBox.result = {
      files: [{ scan_errors: ['Yikes. Tragedy has struck'] }, { scan_errors: ['Panic'] }]
    }
    expect(Handler._hasRealErrors()).to.be.true
    Handler._resultBox.result = {
      files: []
    }
    expect(Handler._hasRealErrors()).to.be.false
    Handler._resultBox.result = {
      files: [{}]
    }
    expect(Handler._hasRealErrors()).to.be.false
  })

  beforeEach(() => {
    const resultBox = {}
    const fsStub = {
      readFileSync: () => JSON.stringify(resultBox.result)
    }
    const handlerFactory = proxyquire('../../../../providers/process/scancode', {
      fs: fsStub
    })
    Handler = handlerFactory({ logger: { log: () => { } } })
    Handler._resultBox = resultBox
  })

  afterEach(() => {
    sandbox.restore()
  })
})

describe('ScanCode process', () => {
  it('should handle gems', async () => {
    const { request, processor } = setup('2.9.8/gem.json')
    await processor.handle(request)
    expect(request.document._metadata.toolVersion).to.equal('1.2.0')
    expect(flatten(processor.attachFiles.args.map(x => x[1]))).to.have.members([])
  })

  it('should handle simple npms', async () => {
    const { request, processor } = setup('2.9.8/npm-basic.json')
    await processor.handle(request)
    expect(flatten(processor.attachFiles.args.map(x => x[1]))).to.have.members(['package/package.json'])
  })

  it('should handle large npms', async () => {
    const { request, processor } = setup('2.9.8/npm-large.json')
    await processor.handle(request)
    expect(flatten(processor.attachFiles.args.map(x => x[1]))).to.have.members(['package/package.json'])
  })

  it('should skip if ScanCode not found', async () => {
    const { request, processor } = setup(null, null, new Error('error message here'))
    await processor.handle(request)
    expect(request.processControl).to.equal('skip')
  })

  it('handles scancode error', async () => {
    const { request, processor } = setup(null, new Error('error message here'))
    try {
      await processor.handle(request)
      expect(true).to.be.false
    } catch (error) {
      expect(request.processControl).to.equal('skip')
    }
  })

  beforeEach(function () {
    const resultBox = { error: null, versionResult: 'ScanCode version 1.2.0\n', versionError: null }
    const processStub = {
      execFile: (command, parameters, callbackOrOptions, callback) => {
        if (parameters.includes('--version'))
          return callbackOrOptions(resultBox.versionError, { stdout: resultBox.versionResult })
        callback(resultBox.error)
      }
    }
    Handler = proxyquire('../../../../providers/process/scancode', { child_process: processStub })
    Handler._resultBox = resultBox
  })

  afterEach(function () {
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
  testRequest.crawler = { storeDeadletter: sinon.stub() }
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
