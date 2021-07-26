// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const expect = require('chai').expect
const sinon = require('sinon')
const GoFetch = require('../../../../providers/fetch/goFetch')
const PassThrough = require('stream').PassThrough
const proxyquire = require('proxyquire')
const Request = require('../../../../ghcrawler').request
const fs = require('fs')

const stub = 'https://proxy.golang.org/'

describe('Go utility functions', () => {
  it('builds URLs', () => {
    const fetch = GoFetch({})
    expect(fetch._buildUrl(spec('go', 'golang.org', 'x', 'net', 'v0.0.0-20210226172049-e18ecbb05110'))).to.equal(stub + 'golang.org/x/net/@v/v0.0.0-20210226172049-e18ecbb05110.zip')
    expect(fetch._buildUrl(spec('go', 'golang.org', 'x', 'net', 'v0.0.0-20210226172049-e18ecbb05110'), '.mod')).to.equal(stub + 'golang.org/x/net/@v/v0.0.0-20210226172049-e18ecbb05110.mod')
    expect(fetch._buildUrl(spec('go', 'golang.org', 'x', 'net', 'v0.0.0-20210226172049-e18ecbb05110'), '.info')).to.equal(stub + 'golang.org/x/net/@v/v0.0.0-20210226172049-e18ecbb05110.info')
    expect(fetch._buildUrl(spec('go', '-', '-', 'collectd.org', 'v0.5.0'))).to.equal(stub + 'collectd.org/@v/v0.5.0.zip')
    expect(fetch._buildUrl(spec('go', 'cloud.google.com', '-', 'go', 'v0.56.0'))).to.equal(stub + 'cloud.google.com/go/@v/v0.56.0.zip')
    expect(fetch._buildUrl(spec('go', 'github.com', 'Azure%2fazure-event-hubs-go', 'v3', 'v3.2.0'))).to.equal(stub + 'github.com/Azure/azure-event-hubs-go/v3/@v/v3.2.0.zip')
  })
})

function spec(type, provider, namespace, name, revision) {
  return { type, provider, namespace, name, revision }
}

