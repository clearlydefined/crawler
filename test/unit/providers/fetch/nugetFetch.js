// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const NuGetFetch = require('../../../../providers/fetch/nugetFetch')({})

const { describe, it } = require('mocha')
const expect = chai.expect

describe('NuGet fetch', () => {
  it('should normalize version correctly', () => {
    expect(NuGetFetch._normalizeVersion('1.0.0.0')).to.equal('1.0.0')
    expect(NuGetFetch._normalizeVersion('1.0.01.0')).to.equal('1.0.1')
    expect(NuGetFetch._normalizeVersion('1.00')).to.equal('1.0')
    expect(NuGetFetch._normalizeVersion('1.01.1')).to.equal('1.1.1')
    expect(NuGetFetch._normalizeVersion('1.00.0.1')).to.equal('1.0.0.1')
    expect(NuGetFetch._normalizeVersion('2.2.20')).to.equal('2.2.20')
    expect(NuGetFetch._normalizeVersion('1.0.000abc')).to.equal('1.0.abc')
    expect(NuGetFetch._normalizeVersion('2.200.0002000.0')).to.equal('2.200.2000')
    expect(NuGetFetch._normalizeVersion('3.00000000000000005')).to.equal('3.5')
    expect(NuGetFetch._normalizeVersion('0.00050')).to.equal('0.50')
  })
})
