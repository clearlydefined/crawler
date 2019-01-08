// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const BaseHandler = require('../../../lib/baseHandler')

describe('BaseHandler util functions', () => {
  it('version aggregation with one version', () => {
    const result = new BaseHandler({}).aggregateVersions(['1.2.3'], 'should not happen')
    expect(result).to.equal('1.2.3')
  })

  it('version aggregation with multiple versions', () => {
    const result = new BaseHandler({}).aggregateVersions(['1.2.3', '2.3.4'], 'should not happen')
    expect(result).to.equal('3.5.7')
  })

  it('version aggregation should fail with long versions', () => {
    try {
      new BaseHandler({}).aggregateVersions(['1.2.3', '2.3.4.5'], 'should not happen')
      expect(false).to.be.true
    } catch (error) {
      expect(error.message.includes('should not happen')).to.be.true
    }
  })

  it('version aggregation should fail with non-numeric versions', () => {
    try {
      new BaseHandler({}).aggregateVersions(['1.2.3', '2.3.b34'], 'should not happen')
      expect(false).to.be.true
    } catch (error) {
      expect(error.message.includes('should not happen')).to.be.true
    }
  })

  it('version collection includes all superclasses', () => {
    const foo = class Foo extends BaseHandler {
      get schemaVersion() {
        return '1.2.3'
      }
    }
    const bar = class Bar extends foo {
      get schemaVersion() {
        return '2.3.4'
      }
    }
    const handler = new bar({})
    expect(handler._toolVersion).to.equal('3.5.7')
  })

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
