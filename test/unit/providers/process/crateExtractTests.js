// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect

const CrateExtract = require('../../../../providers/process/crateExtract')

describe('crateExtract', () => {
  it('handles only crates', () => {
    const crateExtract = CrateExtract({})
    expect(crateExtract.canHandle({ type: 'crate', url: 'cd:/crate/cratesio/-/name/0.1.0' })).to.be.true
    expect(crateExtract.canHandle({ type: 'npm', url: 'cd:/npm/npmjs/-/name/0.1.0' })).to.be.false
  })
})
