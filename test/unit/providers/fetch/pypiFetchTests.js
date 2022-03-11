// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const PypiFetch = require('../../../../providers/fetch/pypiFetch')
const requestRetryWithDefaults = require('../../../../providers/fetch/requestRetryWithDefaults')
const Request = require('../../../../ghcrawler/lib/request.js')
const pypiFetchOptions = { logger: { info: sinon.stub() } }

describe('pypiFetch handle function', () => {
  let sandbox = sinon.createSandbox()
  let requestGetStub
  let fetch

  beforeEach(function () {
    requestGetStub = sandbox.stub(requestRetryWithDefaults, 'get')
    fetch = PypiFetch(pypiFetchOptions)
  })

  afterEach(function () {
    sandbox.restore()
  })

  it('returns missing when registry data is not found', async () => {
    // Setup the stub to return an empty response (e.g. no body)
    requestGetStub.returns({})

    let result = await fetch.handle(new Request('pypi', 'cd:/pypi/pypi/-/reuse/0.8.1'))

    expect(result.outcome).to.be.equal('Missing  ')
  })

  it('returns missing when failed to find download url', async () => {
    // release information in the registry data is empty
    requestGetStub.returns({
      body: {
        'releases': { '1.10.0': [] }
      },
      statusCode: 200
    })

    let result = await fetch.handle(new Request('pypi', 'cd:/pypi/pypi/-/dnspython/1.10.0'))
    expect(result.outcome).to.be.equal('Missing  ')
  })
})
