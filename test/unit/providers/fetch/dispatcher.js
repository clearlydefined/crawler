// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const spies = require('chai-spies')
const Request = require('ghcrawler').request

chai.use(spies)
const should = chai.should()
const expect = chai.expect

const FetchDispatcher = require('../../../../providers/fetch/dispatcher')

describe('fetchDispatcher', () => {
  it('should handle any request', () => {
    const fetchDispatcher = FetchDispatcher({})
    expect(fetchDispatcher.canHandle({})).to.eq(true)
  })

  it('should call markNoSave if processor should not fetch', async () => {
    const processorsStub = [{ canHandle: req => true, shouldFetch: req => false }]
    const fetchDispatcher = FetchDispatcher({}, {}, {}, processorsStub)
    const request = {}
    chai.spy.on(request, 'markNoSave', () => {})
    await fetchDispatcher.handle(request)
    expect(request.markNoSave).to.have.been.called.once
  })

  it('should markSkip request if missing from store and should not fetch missing', async () => {
    const storeStub = { get: (type, documentKey) => null }
    const processorsStub = [{ canHandle: req => true, shouldFetch: req => true, getUrnFor: req => 'documentkey' }]
    const filterStub = { shouldFetchMissing: req => false }
    const fetchDispatcher = FetchDispatcher({}, storeStub, {}, processorsStub, filterStub)
    const request = new Request('test', 'http://test')
    const result = await fetchDispatcher.handle(request)
    expect(result.shouldSkip()).to.be.true
  })
})
