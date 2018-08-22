// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const NpmExtract = require('../../../../providers/process/npmExtract')

describe('npmExtract', () => {
  it('should get name + namespace from registry', () => {
    const { name, namespace } = NpmExtract({})._getNameAndNamespaceFromRegistry('@name-space/packageid')
    expect(name).to.eq('packageid')
    expect(namespace).to.eq('@name-space')
  })

  it('should get name from registry given no namespace', () => {
    const { name, namespace } = NpmExtract({})._getNameAndNamespaceFromRegistry('packageid')
    expect(name).to.eq('packageid')
    expect(namespace).to.eq(null)
  })

  it('should handle undefined name from registry', () => {
    const { name, namespace } = NpmExtract({})._getNameAndNamespaceFromRegistry()
    expect(!!name).to.be.false
    expect(!!namespace).to.be.false
  })
})
