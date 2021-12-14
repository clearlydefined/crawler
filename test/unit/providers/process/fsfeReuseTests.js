// Copyright (c) SAP SE and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const proxyquire = require('proxyquire')
const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const fs = require('fs')
const path = require('path')
const { request } = require('../../../../ghcrawler')

let Handler

describe('FSFE REUSE software process', () => {
  it('should handle a standard output', async () => {
    const { request, processor } = setup('0.15.0/folder1')
    await processor.handle(request)
    const { document } = request
    expect(document.reuse.metadata.DocumentName).to.equal('ospo-reuse')
    expect(document.reuse.metadata.CreatorTool).to.equal('reuse-0.13')
    expect(document.reuse.files.length).to.equal(4)
    let readmeFound = false
    let securityFound = false
    let helloWorldFound = false
    let testHelloWorldFound = false
    for (var i = 0; i < document.reuse.files.length; i++) {
      if (document.reuse.files[i].FileName === 'README.md') {
        readmeFound = true
        expect(document.reuse.files[i].LicenseConcluded).to.equal('NOASSERTION')
        expect(document.reuse.files[i].LicenseInfoInFile).to.equal('Apache-2.0')
        expect(document.reuse.files[i].FileCopyrightText).to.equal('1982-2021 SAP SE or an SAP affiliate company and ospo-reuse contributors')
      }
      if (document.reuse.files[i].FileName === 'SECURITY.md') {
        securityFound = true
        expect(document.reuse.files[i].LicenseConcluded).to.equal('NOASSERTION')
        expect(document.reuse.files[i].LicenseInfoInFile).to.equal('Beerware')
        expect(document.reuse.files[i].FileCopyrightText).to.equal('2013-2017 SAP SE or an SAP affiliate company and ospo-reuse contributors')
      }
      if (document.reuse.files[i].FileName === 'ospo-reuse/src/main/java/com/sap/ospo-reuse/HelloWorld.java') {
        helloWorldFound = true
        expect(document.reuse.files[i].LicenseConcluded).to.equal('NOASSERTION')
        expect(document.reuse.files[i].LicenseInfoInFile).to.equal('GPL-3.0-or-later')
        expect(document.reuse.files[i].FileCopyrightText).to.equal('2019-2021 SAP SE or an SAP affiliate company and ospo-reuse contributors')
      }
      if (document.reuse.files[i].FileName === 'ospo-reuse/src/test/java/com/sap/ospo-reuse/TestsHelloWorld.java') {
        testHelloWorldFound = true
        expect(document.reuse.files[i].LicenseConcluded).to.equal('WTFPL')
        expect(document.reuse.files[i].LicenseInfoInFile).to.be.undefined
        expect(document.reuse.files[i].FileCopyrightText).to.equal('NONE')
      }
    }
    expect(readmeFound).to.be.true
    expect(securityFound).to.be.true
    expect(helloWorldFound).to.be.true
    expect(testHelloWorldFound).to.be.true
  })

  it('should handle an empty files list', async () => {
    const { request, processor } = setup('0.15.0/folder2')
    await processor.handle(request)
    const { document } = request
    expect(document.reuse.metadata.DocumentName).to.equal('ospo-reuse')
    expect(document.reuse.metadata.CreatorTool).to.equal('reuse-0.13')
    expect(document.reuse.files.length).to.equal(0)
  })

  it('should return an error properly', async () => {
    const { request, processor } = setup('0.15.0/folder2', new Error('REUSE encountered an error'))
    await processor.handle(request)
    expect(request.message).to.equal('REUSE encountered an error')
    expect(request.outcome).to.equal('Error')
    expect(request.processControl).to.equal('skip')
    expect(request.crawler.storeDeadletter.calledOnce).to.be.true
  })

  it('should skip if REUSE tool was not found', async () => {
    const { request, processor } = setup(null, null, new Error('REUSE was not found...'))
    await processor.handle(request)
    expect(request.processControl).to.equal('skip')
  })

  beforeEach(function () {
    const resultBox = { error: null, versionResult: 'reuse 0.13.0', versionError: null }
    const processStub = {
      execFile: (command, parameters, callbackOrOptions, callback) => {
        if (parameters.includes('--version')) {
          return callbackOrOptions(resultBox.versionError, { stdout: resultBox.versionResult })
        }
        callback(resultBox.error, { stdout: fs.readFileSync(`${callbackOrOptions.cwd}/output.txt`).toString() })
      }
    }
    Handler = proxyquire('../../../../providers/process/fsfeReuse', { child_process: processStub })
    Handler._resultBox = resultBox
  })

  afterEach(function () {
    sandbox.restore()
  })
})

function setup(fixture, error, versionError) {
  const options = { logger: { log: sinon.stub() } }
  const testRequest = new request('reuse', 'cd:/git/github/SAP/ospo/424242')
  testRequest.document = { _metadata: { links: {} }, location: path.resolve(`test/fixtures/fsfeReuse/${fixture}`) }
  testRequest.crawler = { storeDeadletter: sinon.stub() }
  Handler._resultBox.error = error
  Handler._resultBox.versionError = versionError
  const processor = Handler(options)
  processor.attachFiles = sinon.stub()
  return { request: testRequest, processor }
}
