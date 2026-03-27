// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const sinon = require('sinon')
const Insights = require('../../../../providers/logging/insights')

describe('insights flush', () => {
  let client
  let insights

  beforeEach(() => {
    client = {
      flush: sinon.stub()
    }
    insights = new Insights({}, client, false)
  })

  it('resolves immediately when no underlying client is configured', async () => {
    insights = new Insights({}, null, false)
    await insights.flush()
  })

  it('resolves when client flush resolves', async () => {
    client.flush.resolves()
    await insights.flush()
    expect(client.flush.calledOnce).to.equal(true)
  })

  it('rejects when client flush rejects', async () => {
    client.flush.rejects(new Error('flush rejected'))
    try {
      await insights.flush()
      expect.fail('should have rejected')
    } catch (err) {
      expect(err.message).to.equal('flush rejected')
    }
    expect(client.flush.calledOnce).to.equal(true)
  })
})
