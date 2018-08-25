// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const NpmFetch = require('../../../../providers/fetch/npmjsFetch')
const EntitySpec = require('../../../../lib/entitySpec')

const spec_nonnamespace = new EntitySpec('npm', 'npmjs', '-', 'name1', '1.0.0')
const spec_namespace = new EntitySpec('npm', 'npmjs', '@namespace1', 'name1', '1.0.0')

describe('npmjsFetch', () => {
  it('should get name + namespace from registry', () => {
    const casedSpec = NpmFetch({})._getCasedSpec(spec_namespace, { name: '@Namespace/Name1' })
    expect(casedSpec).to.deep.equal(new EntitySpec('npm', 'npmjs', '@Namespace', 'Name1', '1.0.0'))
  })

  it('should get name from registry given no namespace', () => {
    const casedSpec = NpmFetch({})._getCasedSpec(spec_nonnamespace, { name: 'Name1' })
    expect(casedSpec).to.deep.equal(new EntitySpec('npm', 'npmjs', '-', 'Name1', '1.0.0'))
  })

  it('should handle undefined name from registry', () => {
    const casedSpec = NpmFetch({})._getCasedSpec(spec_nonnamespace, {})
    expect(!!casedSpec).to.be.false
  })
})
