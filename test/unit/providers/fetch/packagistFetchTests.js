// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const PassThrough = require('stream').PassThrough
const PackagistFetch = require('../../../../providers/fetch/packagistFetch')
const proxyquire = require('proxyquire')
const Request = require('../../../../ghcrawler').request
const fs = require('fs')

let Fetch

const hashes = {
  'symfony-polyfill-mbstring-v1.11.0-0-gfe5e94c.zip': {
    sha1: '8d24c52e593042529ba86549d9920eb4d9649763',
    sha256: '797a607b7ea7dad62f78a56f3687f2b2108d221b0682d0ea1386db61714dc8a2'
  }
}

describe('packagistFetch', () => {
  beforeEach(() => {
    const resultBox = {}
    const requestRetryStub = {
      get: url => {
        if (url.includes('regError')) throw new Error('Invalid url')
        if (url.includes('missing')) return { statusCode: 404, body: null }
        if (url.includes('symfony/polyfill-mbstring')) {
          return { statusCode: 200, body: resultBox.result }
        }
        return { statusCode: 200, body: resultBox.result }
      }
    }
    const getStub = url_hash => {
      const response = new PassThrough()
      if (url_hash.url.includes('symfony/polyfill-mbstring')) {
        response.data = new PassThrough()
        response.data.write(fs.readFileSync('test/fixtures/composer/symfony-polyfill-mbstring-v1.11.0-0-gfe5e94c.zip'))
        response.data.end()
        response.statusCode = 200
      } else {
        return Promise.reject(new Error(url_hash.includes('error') ? 'Error' : 'Code'))
      }
      response.end()
      return Promise.resolve(response)
    }
    Fetch = proxyquire('../../../../providers/fetch/packagistFetch', {
      '../../lib/fetch': { callFetch: requestRetryStub, getStream: getStub }
    })
    Fetch._resultBox = resultBox
  })

  afterEach(() => {
    sinon.restore()
  })

  it('can handle the request being attempted', async () => {
    expect(PackagistFetch({}).canHandle(new Request('test', 'cd:/composer/packagist/symfony/polyfill-mbstring/1.11.0')))
      .to.be.true
  })

  it('succeeds in download, decompress and hash', async () => {
    const handler = setup(createRegistryData())
    const request = await handler.handle(new Request('test', 'cd:/composer/packagist/symfony/polyfill-mbstring/1.11.0'))
    request.fetchResult.copyTo(request)
    expect(request.document.hashes.sha1).to.be.equal(hashes['symfony-polyfill-mbstring-v1.11.0-0-gfe5e94c.zip']['sha1'])
    expect(request.document.hashes.sha256).to.be.equal(
      hashes['symfony-polyfill-mbstring-v1.11.0-0-gfe5e94c.zip']['sha256']
    )
    expect(request.document.dirRoot).to.be.equal('symfony-polyfill-mbstring-fe5e94c')
    expect(request.document.releaseDate).to.equal('2019-02-06T07:57:58+00:00')
  })

  it('handles download error', async () => {
    const handler = setup(createRegistryData())
    handler._getRegistryData = () => {
      throw new Error('Error')
    }
    try {
      await handler.handle(new Request('test', 'cd:/composer/packagist/fakepackage/polyfill-mbstring/1.11.0'))
    } catch (error) {
      expect(error.message).to.be.equal('Error')
    }
  })

  it('handles missing registry data', async () => {
    const handler = setup(createRegistryData())
    handler._getRegistryData = () => null
    const request = await handler.handle(new Request('test', 'cd:/composer/packagist/-/missing/1.11.0'))
    expect(request.processControl).to.be.equal('skip')
  })

  it('handles error getting registry data', async () => {
    const handler = setup(createRegistryData())
    handler._getRegistryData = () => {
      throw new Error('Invalid url')
    }
    try {
      await handler.handle(new Request('test', 'cd:/composer/packagist/-/regError/1.11.0'))
    } catch (error) {
      expect(error.message).to.be.equal('Invalid url')
    }
  })

  describe('_getRegistryData', () => {
    it('should parse p2 format registry data correctly with v prefix', async () => {
      const handler = setup(createRegistryData())
      const spec = { namespace: 'symfony', name: 'polyfill-mbstring', revision: 'v1.11.0' }

      const result = await handler._getRegistryData(spec)

      expect(result).to.not.be.null
      expect(result.manifest).to.exist
      expect(result.manifest.version).to.equal('v1.11.0')
      expect(result.manifest.dist.url).to.include('zipball/fe5e94c604826c35a32fa832f35bd036b6799609')
      expect(result.releaseDate).to.equal('2019-02-06T07:57:58+00:00')
      expect(result.packages).to.be.undefined // Should be deleted
      // Note: v1.11.0 entry in p2 format doesn't include name field, only version/dist/source/time
    })

    it('should handle version without v prefix in spec but find v prefix in data', async () => {
      const handler = setup(createRegistryData())
      const spec = { namespace: 'symfony', name: 'polyfill-mbstring', revision: '1.33.0' }

      const result = await handler._getRegistryData(spec)

      expect(result).to.not.be.null
      expect(result.manifest).to.exist
      expect(result.manifest.version).to.equal('v1.33.0')
      expect(result.manifest.time).to.equal('2024-12-23T08:48:59+00:00')
      expect(result.manifest.dist.url).to.exist
    })

    it('should return null for missing version', async () => {
      const handler = setup(createRegistryData())
      const spec = { namespace: 'symfony', name: 'polyfill-mbstring', revision: '99.99.99' }

      const result = await handler._getRegistryData(spec)

      expect(result).to.be.null
    })

    it('should handle latest version correctly', async () => {
      const handler = setup(createRegistryData())
      const spec = { namespace: 'symfony', name: 'polyfill-mbstring', revision: 'v1.33.0' }

      const result = await handler._getRegistryData(spec)

      expect(result).to.not.be.null
      expect(result.manifest).to.exist
      expect(result.manifest.version).to.equal('v1.33.0')
      expect(result.releaseDate).to.equal('2024-12-23T08:48:59+00:00')
      expect(result.manifest.dist).to.exist
      expect(result.manifest.dist.url).to.include('zipball')
    })

    it('should return null for missing package', async () => {
      const handler = setup(createRegistryData())
      handler._getRegistryData = async () => {
        return null // Simulate 404 response
      }
      const spec = { namespace: 'nonexistent', name: 'package', revision: '1.0.0' }

      const result = await handler._getRegistryData(spec)

      expect(result).to.be.null
    })
  })
})

function createRegistryData() {
  return JSON.parse(fs.readFileSync('test/fixtures/packagist/registryData.json'))
}

function setup(registryData) {
  const options = { logger: { log: sinon.stub() } }
  const handler = Fetch(options)
  Fetch._resultBox.result = registryData
  return handler
}
