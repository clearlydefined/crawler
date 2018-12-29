// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const PassThrough = require('stream').PassThrough
const proxyquire = require('proxyquire')
const Request = require('ghcrawler').request
const fs = require('fs')

let Fetch

const hashes = {
  'redie-0.3.0': {
    'redie-0.3.0.tgz': {
      1: '48581317ac174ac269c398ff946d6c4779145374',
      256: '66185c319680ee41268217c2467e314019e8ba4ea4d8374335fbe29e64a8d19f'
    }
  }
}

describe('', () => {
  beforeEach(() => {
    const getStub = (url, callback) => {
      const response = new PassThrough()
      if (url.includes('redie')) {
        response.write(fs.readFileSync('test/fixtures/npm/redie-0.3.0/redie-0.3.0.tgz'))
        callback(null, { statusCode: 200 })
      } else {
        callback(new Error(url.includes('error') ? 'Error' : 'Code'))
      }
      response.end()
      return response
    }
    Fetch = proxyquire('../../../../providers/fetch/npmjsFetch', { request: { get: getStub } })
  })

  afterEach(function() {
    sandbox.restore()
  })

  it('succeeds in download, decompress and hash', async () => {
    const handler = setup({ manifest: { version: '0.3.0' } })
    const request = await handler.handle(new Request('test', 'cd:/npm/npmjs/-/redie/0.3.0'))
    expect(request.document.hashes.sha1).to.be.equal(hashes['redie-0.3.0']['redie-0.3.0.tgz'][1])
    expect(request.document.hashes.sha256).to.be.equal(hashes['redie-0.3.0']['redie-0.3.0.tgz'][256])
  })

  it('handles download error', async () => {
    const handler = setup({ manifest: { version: '0.3.0' } })
    try {
      await handler.handle(new Request('test', 'cd:/npm/npmjs/-/error/0.3.0'))
      expect(false).to.be.true
    } catch (error) {
      expect(error.message).to.be.equal('Error')
    }
  })

  it('handles download non-200 status code', async () => {
    const handler = setup({ manifest: { version: '0.3.0' } })
    try {
      await handler.handle(new Request('test', 'cd:/npm/npmjs/-/code/0.3.0'))
      expect(false).to.be.true
    } catch (error) {
      expect(error.message).to.be.equal('Code')
    }
  })

  it('missing registry data', async () => {
    const handler = setup()
    const request = await handler.handle(new Request('test', 'cd:/npm/npmjs/-/code/0.3.0'))
    expect(request.processControl).to.be.equal('skip')
  })
})

function setup(registryData) {
  const options = { logger: { log: sinon.stub() } }
  const handler = Fetch(options)
  handler._getRegistryData = () => registryData
  return handler
}
