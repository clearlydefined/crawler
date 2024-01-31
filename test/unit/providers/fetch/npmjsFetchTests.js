// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const NpmFetch = require('../../../../providers/fetch/npmjsFetch')
const EntitySpec = require('../../../../lib/entitySpec')
const PassThrough = require('stream').PassThrough
const proxyquire = require('proxyquire')
const Request = require('../../../../ghcrawler').request
const fs = require('fs')

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

  it('should create document with releaseDate', () => {
    const document = NpmFetch({})._createDocument({ name: 'foo' }, { releaseDate: '01/01/2018' })
    expect(document.location).to.eq('foo')
    expect(document.releaseDate).to.eq('01/01/2018')
  })

  it('should create document with null registryData', () => {
    const document = NpmFetch({})._createDocument({ name: 'foo' }, null)
    expect(document.location).to.eq('foo')
  })
})

let Fetch

const hashes = {
  'redie-0.3.0.tgz': {
    sha1: '48581317ac174ac269c398ff946d6c4779145374',
    sha256: '66185c319680ee41268217c2467e314019e8ba4ea4d8374335fbe29e64a8d19f'
  }
}

describe('', () => {
  beforeEach(() => {
    const resultBox = {}
    const requestPromiseStub = options => {
      if (options.url) {
        if (options.url.includes('regError')) throw new Error('yikes')
        if (options.url.includes('missing')) throw { statusCode: 404 }
      }
      return resultBox.result
    }
    const getStub = (url, callback) => {
      const response = new PassThrough()
      if (url.includes('redie')) {
        response.write(fs.readFileSync('test/fixtures/npm/redie-0.3.0.tgz'))
        callback(null, { statusCode: 200 })
      } else {
        callback(new Error(url.includes('error') ? 'Error' : 'Code'))
      }
      response.end()
      return response
    }
    Fetch = proxyquire('../../../../providers/fetch/npmjsFetch', {
      request: { get: getStub },
      'request-promise-native': requestPromiseStub
    })
    Fetch._resultBox = resultBox
  })

  afterEach(function () {
    sinon.restore()
  })

  it('succeeds in download, decompress and hash', async () => {
    const handler = setup(createRegistryData('0.3.0'))
    const request = await handler.handle(new Request('test', 'cd:/npm/npmjs/-/redie/0.3.0'))
    request.fetchResult.copyTo(request)
    expect(request.document.hashes.sha1).to.be.equal(hashes['redie-0.3.0.tgz']['sha1'])
    expect(request.document.hashes.sha256).to.be.equal(hashes['redie-0.3.0.tgz']['sha256'])
    expect(request.document.releaseDate).to.equal('42')
    expect(request.document.registryData.manifest.test).to.be.true
  })

  it('handles download error', async () => {
    const handler = setup(createRegistryData('0.3.0'))
    try {
      await handler.handle(new Request('test', 'cd:/npm/npmjs/-/error/0.3.0'))
      expect(false).to.be.true
    } catch (error) {
      expect(error.message).to.be.equal('Error')
    }
  })

  it('handles download with non-200 status code', async () => {
    const handler = setup(createRegistryData('0.3.0'))
    try {
      await handler.handle(new Request('test', 'cd:/npm/npmjs/-/code/0.3.0'))
      expect(false).to.be.true
    } catch (error) {
      expect(error.message).to.be.equal('Code')
    }
  })

  it('handles missing registry data', async () => {
    const handler = setup(createRegistryData('0.3.0'))
    const request = await handler.handle(new Request('test', 'cd:/npm/npmjs/-/missing/0.3.0'))
    expect(request.processControl).to.be.equal('skip')
  })

  it('handles error getting registry data', async () => {
    const handler = setup(createRegistryData('0.3.0'))
    try {
      await handler.handle(new Request('test', 'cd:/npm/npmjs/-/regError/0.3.0'))
      expect(false).to.be.true
    } catch (error) {
      expect(error.message).to.be.equal('yikes')
    }
  })
})

function createRegistryData(version) {
  return {
    manifest: { version },
    versions: { [version]: { test: true } },
    time: { [version]: '42' }
  }
}

function setup(registryData) {
  const options = { logger: { log: sinon.stub() } }
  const handler = Fetch(options)
  Fetch._resultBox.result = registryData
  return handler
}
