// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const SourceExtract = require('../../../../providers/process/sourceExtract')

describe('SourceExtract', () => {
  it('verifies version of the source extract', () => {
    const handler = SourceExtract({})
    expect(handler._schemaVersion).to.equal('1.3.0')
  })
})
