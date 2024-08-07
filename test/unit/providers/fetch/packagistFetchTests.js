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
    const requestPromiseStub = options => {
      if (options.url) {
        if (options.url.includes('regError')) throw new Error('Invalid url')
        if (options.url.includes('missing')) throw { statusCode: 404 }
      }
      return resultBox.result
    }
    const getStub = (url_hash, callback) => {
      const response = new PassThrough()
      if (url_hash.url.includes('symfony/polyfill-mbstring')) {
        response.write(fs.readFileSync('test/fixtures/composer/symfony-polyfill-mbstring-v1.11.0-0-gfe5e94c.zip'))
        callback(null, { statusCode: 200 })
      } else {
        callback(new Error(url_hash.includes('error') ? 'Error' : 'Code'))
      }
      response.end()
      return response
    }
    Fetch = proxyquire('../../../../providers/fetch/packagistFetch', {
      request: { get: getStub },
      '../../lib/fetch': { callFetch: requestPromiseStub }
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
    handler._getRegistryData = () => createRegistryData()
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
    const handler = setup(createRegistryData('0.3.0'))
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
    const handler = setup(createRegistryData('0.3.0'))
    handler._getRegistryData = () => null
    const request = await handler.handle(new Request('test', 'cd:/composer/packagist/-/missing/1.11.0'))
    expect(request.processControl).to.be.equal('skip')
  })

  it('handles error getting registry data', async () => {
    const handler = setup(createRegistryData('0.3.0'))
    handler._getRegistryData = () => {
      throw new Error('Invalid url')
    }
    try {
      await handler.handle(new Request('test', 'cd:/composer/packagist/-/regError/1.11.0'))
    } catch (error) {
      expect(error.message).to.be.equal('Invalid url')
    }
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
