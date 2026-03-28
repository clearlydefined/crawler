// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

/// <reference types="mocha" />

import { expect } from 'chai'
import sinon, { type SinonStub } from 'sinon'
import Insights from '../../../../providers/logging/insights.js'

type TelemetryClient = import('applicationinsights').TelemetryClient

type FlushClient = Partial<TelemetryClient> & {
  flush: SinonStub<[], Promise<void>>
}

describe('insights flush', () => {
  let client: FlushClient
  let insights: InstanceType<typeof Insights>

  beforeEach(() => {
    client = {
      flush: sinon.stub()
    }
    const telemetryClient = client as unknown as TelemetryClient
    insights = new Insights({}, telemetryClient, false)
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
    } catch (err: unknown) {
      expect(err).to.be.instanceOf(Error)
      expect((err as Error).message).to.equal('flush rejected')
    }
    expect(client.flush.calledOnce).to.equal(true)
  })
})
