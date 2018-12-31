// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const CrateFetch = require('../../../../providers/fetch/crateFetch')
const expect = chai.expect

describe('crateFetch', () => {
  it('should handle crate requests', () => {
    const crateFetch = mockCrateFetch({})
    expect(crateFetch.canHandle({ url: 'cd:/crate/cratesio/-/name/0.1.0' })).to.be.true
    expect(crateFetch.canHandle({ url: 'cd:/npm/npmjs/-/name/0.1.0' })).to.be.false
  })

  it('should markskip when no version', async () => {
    const crateFetch = mockCrateFetch({
      registryData: () => {
        return { manifest: null, version: null }
      }
    })
    const request = { url: 'cd:/crate/cratesio/-/name/0.1.0' }
    chai.spy.on(request, 'markSkip', () => request)
    await crateFetch.handle(request)
    expect(request.url).to.eq('cd:/crate/cratesio/-/name/0.1.0')
    expect(request.markSkip).to.be.called.once
    expect(request.document).to.be.undefined
    expect(request.casedSpec).to.be.undefined
  })

  it('should set latest version when found', async () => {
    const crateFetch = mockCrateFetch({
      registryData: () => {
        return { manifest: {}, version: { num: '0.5.0', crate: 'name' } }
      }
    })
    const request = await crateFetch.handle({ url: 'cd:/crate/cratesio/-/name/0.1.0' })
    expect(request.url).to.eq('cd:/crate/cratesio/-/name/0.5.0')
  })

  it('should preserve case from registry', async () => {
    const crateFetch = mockCrateFetch({
      registryData: () => {
        return { manifest: {}, version: { num: '0.1.0', crate: 'name' } }
      }
    })
    const request = await crateFetch.handle({ url: 'cd:/crate/cratesio/-/naME/0.1.0' })
    expect(request.casedSpec.name).to.eq('name')
  })
})

function mockCrateFetch(options) {
  const crateFetch = CrateFetch({})
  if (options.registryData) crateFetch._getRegistryData = options.registryData
  crateFetch.createTempDir = () => {
    return { name: '/tmp' }
  }
  crateFetch._getPackage = () => '/tmp/crate'
  crateFetch.decompress = () => {}
  crateFetch.computeHashes = () => {
    return { sha1: '42' }
  }
  return crateFetch
}
