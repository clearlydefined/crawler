// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const NuGetFetch = require('../../../../providers/fetch/nugetFetch')
const proxyquire = require('proxyquire')
const Request = require('ghcrawler').request
const PassThrough = require('stream').PassThrough
const fs = require('fs')

describe('NuGet fetch', () => {
  it('should normalize version correctly', () => {
    expect(NuGetFetch({})._normalizeVersion('1.0.0.0')).to.equal('1.0.0')
    expect(NuGetFetch({})._normalizeVersion('1.0.01.0')).to.equal('1.0.1')
    expect(NuGetFetch({})._normalizeVersion('1.00')).to.equal('1.0')
    expect(NuGetFetch({})._normalizeVersion('1.01.1')).to.equal('1.1.1')
    expect(NuGetFetch({})._normalizeVersion('1.00.0.1')).to.equal('1.0.0.1')
    expect(NuGetFetch({})._normalizeVersion('2.2.20')).to.equal('2.2.20')
    expect(NuGetFetch({})._normalizeVersion('1.0.000abc')).to.equal('1.0.abc')
    expect(NuGetFetch({})._normalizeVersion('2.200.0002000.0')).to.equal('2.200.2000')
    expect(NuGetFetch({})._normalizeVersion('3.00000000000000005')).to.equal('3.5')
    expect(NuGetFetch({})._normalizeVersion('0.00050')).to.equal('0.50')
    expect(NuGetFetch({})._normalizeVersion('3.0.0')).to.equal('3.0.0')
    expect(NuGetFetch({})._normalizeVersion('3.0.0-alpha')).to.equal('3.0.0-alpha')
    expect(NuGetFetch({})._normalizeVersion('2.1.0-preview2-final')).to.equal('2.1.0-preview2-final')
    expect(NuGetFetch({})._normalizeVersion('4.5.0-preview2-26406-04')).to.equal('4.5.0-preview2-26406-04')
  })
})

let Fetch

const hashes = {
  'xunit.core.2.4.1.nupkg': {
    sha1: '362ec34f3358c23e2effa87ecfc5de1c4292d60a',
    sha256: '2a05200082483c7439550e05881fa2e6ed895d26319af30257ccd73f891ccbda'
  }
}

function pickFile(url) {
  if (url.includes('catalog')) return 'xunit.core.2.4.1.catalog.json'
  if (url.endsWith('index.json')) return 'xunit.core.index.json'
  if (url.endsWith('.json')) return 'xunit.core.2.4.1.json'
  if (url.endsWith('.nuspec')) return 'xunit.core.2.4.1.nuspec'
  if (url.endsWith('.nupkg')) return 'xunit.core.2.4.1.nupkg'
  return null
}

describe('', () => {
  beforeEach(() => {
    const get = (url, options) => {
      if (url) {
        if (url.includes('error')) throw new Error('yikes')
        if (url.includes('missing')) throw { statusCode: 404 }
      }
      const body = fs.readFileSync(`test/fixtures/nuget/${pickFile(url)}`)
      if (options && options.json) return { body: JSON.parse(body), statusCode: 200 }
      const response = new PassThrough()
      response.body = body
      response.write(response.body)
      response.end()
      response.statusCode = 200
      return response
    }
    const requestRetryStub = {
      defaults: () => {
        return { get }
      }
    }
    Fetch = proxyquire('../../../../providers/fetch/nugetFetch', { requestretry: requestRetryStub })
  })

  afterEach(function() {
    sinon.sandbox.restore()
  })

  it('succeeds in download, decompress and hash', async () => {
    const handler = setup()
    const request = await handler.handle(new Request('test', 'cd:/nuget/nuget/-/xunit.core/2.4.1'))
    expect(request.document.hashes.sha1).to.be.equal(hashes['xunit.core.2.4.1.nupkg']['sha1'])
    expect(request.document.hashes.sha256).to.be.equal(hashes['xunit.core.2.4.1.nupkg']['sha256'])
    expect(request.document.releaseDate).to.equal('2018-10-29T04:18:45.803Z')
    expect(request.document.metadataLocation).to.have.keys(['manifest', 'nuspec'])
    expect(request.document.location).to.not.be.undefined
  })

  it('succeeds for latest version for download, decompress and hash', async () => {
    const handler = setup()
    const request = await handler.handle(new Request('test', 'cd:/nuget/nuget/-/xunit.core'))
    expect(request.document.hashes.sha1).to.be.equal(hashes['xunit.core.2.4.1.nupkg']['sha1'])
    expect(request.document.hashes.sha256).to.be.equal(hashes['xunit.core.2.4.1.nupkg']['sha256'])
    expect(request.document.releaseDate).to.equal('2018-10-29T04:18:45.803Z')
    expect(request.document.metadataLocation).to.have.keys(['manifest', 'nuspec'])
    expect(request.document.location).to.not.be.undefined
  })

  it('handles missing registry data', async () => {
    const handler = NuGetFetch({})
    handler._getRegistryData = () => null
    const request = await handler.handle(new Request('test', 'cd:/nuget/nuget/-/xunit.core/2.4.1'))
    expect(request.processControl).to.be.equal('skip')
  })

  it('handles missing manifest', async () => {
    const handler = NuGetFetch({})
    handler._getRegistryData = () => '{}'
    handler._getManifest = () => null
    const request = await handler.handle(new Request('test', 'cd:/nuget/nuget/-/xunit.core/2.4.1'))
    expect(request.processControl).to.be.equal('skip')
  })

  it('handles missing nuspec', async () => {
    const handler = NuGetFetch({})
    handler._getRegistryData = () => '{}'
    handler._getManifest = () => '{}'
    handler._getNuspec = () => null
    const request = await handler.handle(new Request('test', 'cd:/nuget/nuget/-/xunit.core/2.4.1'))
    expect(request.processControl).to.be.equal('skip')
  })

  it('handles download error', async () => {
    const handler = setup()
    handler._getRegistryData = () => {
      return { packageContent: 'http://error' }
    }
    handler._getManifest = () => '{}'
    handler._getNuspec = () => '{}'
    handler._createTempDir = () => {}
    handler._persistMetadata = () => {}
    try {
      await handler.handle(new Request('test', 'cd:/nuget/nuget/-/xunit.core/2.4.1'))
      expect(false).to.be.true
    } catch (error) {
      expect(error.message).to.equal('yikes')
    }
  })

  // it('handles download with non-200 status code', async () => {
  //   const handler = setup(createRegistryData('0.3.0'))
  //   try {
  //     await handler.handle(new Request('test', 'cd:/npm/npmjs/-/code/0.3.0'))
  //     expect(false).to.be.true
  //   } catch (error) {
  //     expect(error.message).to.be.equal('Code')
  //   }
  // })

  // it('handles missing registry data', async () => {
  //   const handler = setup(createRegistryData('0.3.0'))
  //   const request = await handler.handle(new Request('test', 'cd:/npm/npmjs/-/missing/0.3.0'))
  //   expect(request.processControl).to.be.equal('skip')
  // })

  // it('handles error getting registry data', async () => {
  //   const handler = setup(createRegistryData('0.3.0'))
  //   try {
  //     await handler.handle(new Request('test', 'cd:/npm/npmjs/-/regError/0.3.0'))
  //     expect(false).to.be.true
  //   } catch (error) {
  //     expect(error.message).to.be.equal('yikes')
  //   }
  // })
})

function setup() {
  const options = { logger: { log: sinon.stub() } }
  const handler = Fetch(options)
  return handler
}
