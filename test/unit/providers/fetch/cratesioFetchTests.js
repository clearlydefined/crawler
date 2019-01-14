// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const CrateFetch = require('../../../../providers/fetch/cratesioFetch')
const PassThrough = require('stream').PassThrough
const proxyquire = require('proxyquire')
const Request = require('ghcrawler').request
const fs = require('fs')

let Fetch

const hashes = {
  'bitflags-1.0.4.crate': {
    sha1: 'fbc1ce9fa176ed7a7e15cfc6d1f6c2389f536361',
    sha256: '228047a76f468627ca71776ecdebd732a3423081fcf5125585bcd7c49886ce12'
  }
}

function pickFile(url) {
  if (url.endsWith('download')) return 'bitflags-1.0.4.crate'
  return 'bitflags.json'
}

describe('', () => {
  beforeEach(() => {
    const requestPromiseStub = options => {
      if (options && options.url) {
        if (options.url.includes('error')) throw new Error('yikes')
        if (options.url.includes('missing')) throw { statusCode: 404 }
      }
      const body = fs.readFileSync(`test/fixtures/crates/${pickFile(options.url)}`)
      if (options && options.json) return JSON.parse(body)
      const response = new PassThrough()
      response.write(fs.readFileSync(`test/fixtures/crates/${pickFile(options.url)}`))
      response.statusCode = 200
      response.end()
      return response
    }
    Fetch = proxyquire('../../../../providers/fetch/cratesioFetch', {
      'request-promise-native': requestPromiseStub
    })
  })

  afterEach(function() {
    sinon.sandbox.restore()
  })

  it('succeeds in download, decompress and hash', async () => {
    const handler = setup()
    const request = await handler.handle(new Request('test', 'cd:/crate/cratesio/-/bitflags/1.0.4'))
    expect(request.document.hashes.sha1).to.be.equal(hashes['bitflags-1.0.4.crate']['sha1'])
    expect(request.document.hashes.sha256).to.be.equal(hashes['bitflags-1.0.4.crate']['sha256'])
    expect(request.document.releaseDate).to.equal('2018-08-21T19:55:12.284583+00:00')
    expect(request.document.registryData.crate).to.equal('bitflags')
    expect(request.document.manifest.id).to.equal('bitflags')
  })

  it('handles download error', async () => {
    const handler = setup()
    handler._getRegistryData = () => {
      return {
        version: { num: '1.0.4', dl_path: 'error' }
      }
    }
    try {
      await handler.handle(new Request('test', 'cd:/crate/cratesio/-/bitflags/1.0.4'))
      expect(false).to.be.true
    } catch (error) {
      expect(error.message).to.be.equal('yikes')
    }
  })

  it('handles download with non-200 status code', async () => {
    const handler = setup()
    handler._getRegistryData = () => {
      return {
        version: { num: '1.0.4', dl_path: 'missing' }
      }
    }
    try {
      await handler.handle(new Request('test', 'cd:/crate/cratesio/-/bitflags/1.0.4'))
      expect(false).to.be.true
    } catch (error) {
      expect(error.statusCode).to.be.equal(404)
    }
  })

  it('handles missing registry data', async () => {
    const handler = setup()
    const request = await handler.handle(new Request('test', 'cd:/crate/cratesio/-/missing/1.0.4'))
    expect(request.processControl).to.equal('skip')
  })

  it('handles error getting registry data', async () => {
    const handler = setup()
    try {
      await handler.handle(new Request('test', 'cd:/crate/cratesio/-/error/1.0.4'))
      expect(false).to.be.true
    } catch (error) {
      expect(error.message).to.be.equal('yikes')
    }
  })
})

function setup() {
  const options = { logger: { log: sinon.stub() } }
  return Fetch(options)
}

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
    const request = new Request('crate', 'cd:/crate/cratesio/-/name/0.1.0')
    await crateFetch.handle(request)
    expect(request.url).to.eq('cd:/crate/cratesio/-/name/0.1.0')
    expect(request.processControl).to.equal('skip')
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
