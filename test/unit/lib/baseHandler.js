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

  it('version aggregation with base version', () => {
    const result = new BaseHandler({}).aggregateVersions(['1.2.3', '2.3.4'], 'should not happen', '1.1.1')
    expect(result).to.equal('4.6.8')
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
})
