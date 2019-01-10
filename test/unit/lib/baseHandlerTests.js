// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const BaseHandler = require('../../../lib/baseHandler')

describe('BaseHandler util functions', () => {
  it('gets latest version', () => {
    const handler = new BaseHandler({})
    expect(handler.getLatestVersion(['2.3.34', '3.2.3', '1.2.0'])).to.equal('3.2.3')
    expect(handler.getLatestVersion(['2.3.34', '0.2.3', '1.2.0'])).to.equal('2.3.34')
    expect(handler.getLatestVersion(['0.3.34', '3.2.3-b43', '1.2.0'])).to.equal('1.2.0')
    expect(handler.getLatestVersion()).to.be.undefined
    expect(handler.getLatestVersion([])).to.be.null
    expect(handler.getLatestVersion('1.2.3')).to.equal('1.2.3')
  })
})
