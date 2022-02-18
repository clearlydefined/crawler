// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const spies = require('chai-spies')
const sinon = require('sinon')
const fs = require('fs')
const PassThrough = require('stream').PassThrough
const Request = require('../../../../ghcrawler').request

chai.use(spies)
const expect = chai.expect

const FetchDispatcher = require('../../../../providers/fetch/dispatcher')
const MavenFetch = require('../../../../providers/fetch/mavencentralFetch')

describe('fetchDispatcher', () => {
  it('should handle any request', () => {
    const fetchDispatcher = FetchDispatcher({})
    expect(fetchDispatcher.canHandle({})).to.eq(true)
  })

  it('should call markNoSave if processor should not fetch', async () => {
    const processorsStub = [{ canHandle: () => true, shouldFetch: () => false }]
    const fetchDispatcher = FetchDispatcher({}, {}, {}, processorsStub)
    const request = {}
    chai.spy.on(request, 'markNoSave', () => { })
    await fetchDispatcher.handle(request)
    expect(request.markNoSave).to.have.been.called.once
  })

  it('should markSkip request if missing from store and should not fetch missing', async () => {
    const storeStub = { get: () => null }
    const processorsStub = [{ canHandle: () => true, shouldFetch: () => true, getUrnFor: () => 'documentkey' }]
    const filterStub = { shouldFetchMissing: () => false }
    const fetchDispatcher = FetchDispatcher({}, storeStub, {}, processorsStub, filterStub)
    const request = new Request('test', 'http://test')
    const result = await fetchDispatcher.handle(request)
    expect(result.shouldSkip()).to.be.true
  })
})

describe('fetchDispatcher cache fetch result', () => {

  function mockResultCache(cache) {
    return {
      get: key => cache[key],
      set: (key, value) => cache[key] = value,
    }
  }

  function setupDispatcher(fetcher, resultCache, promiseCache) {
    const storeStub = { get: () => null }
    const processorsStub = [{ canHandle: () => true, shouldFetch: () => true, getUrnFor: () => 'documentkey' }]
    const filterStub = { shouldFetchMissing: () => true, shouldFetch: () => true }
    const options = { logger: { info: sinon.stub(), debug: sinon.stub() } }
    return FetchDispatcher(options, storeStub, [fetcher], processorsStub, filterStub, mockResultCache(resultCache), promiseCache)
  }

  describe('cache maven fetch result', () => {
    let resultCache
    let inProgressPromiseCache
    let fetchDispatcher

    beforeEach(() => {
      resultCache = {}
      inProgressPromiseCache = {}
      fetchDispatcher = setupDispatcher(setupMavenFetch(), resultCache, inProgressPromiseCache)
    })

    afterEach(() => {
      Object.values(resultCache).forEach(fetched => fetched.cleanup())
    })

    it('cached result same as fetched', async () => {
      const fetched = await fetchDispatcher.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/swt/3.3.0-v3344'))

      expect(Object.keys(resultCache).length).to.be.equal(1)
      expect(Object.keys(inProgressPromiseCache).length).to.be.equal(0)
      const { cleanups, ...expected } = fetched
      expect(cleanups).not.to.be.null

      fetchDispatcher._fetchPromise = sinon.stub().rejects('should not be called')
      const resultFromCache = await fetchDispatcher.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/swt/3.3.0-v3344'))
      expect(resultFromCache).to.be.deep.equal(expected)
    })

    it('no cache for missing maven fetch', async () => {
      const fetched = await fetchDispatcher.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/swt'))
      expect(fetched.processControl).to.be.equal('skip')
      expect(Object.keys(resultCache).length).to.be.equal(0)
      expect(Object.keys(inProgressPromiseCache).length).to.be.equal(0)
    })


    it('no cache for failed maven fetch', async () => {
      try {
        await fetchDispatcher.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/error/3.3.0-v3344'))
        expect(false).to.be.true
      } catch (error) {
        expect(error.message).to.be.equal('yikes')
        expect(Object.keys(resultCache).length).to.be.equal(0)
        expect(Object.keys(inProgressPromiseCache).length).to.be.equal(0)
      }
    })
  })
})


function setupMavenFetch() {
  const pickArtifact = url => {
    if (url.endsWith('.pom')) return 'swt-3.3.0-v3346.pom'
    if (url.endsWith('-sources.jar')) return 'swt-3.3.0-v3346.jar'
    if (url.endsWith('.jar')) return 'swt-3.3.0-v3346.jar'
    return null
  }
  const requestPromiseStub = options => {
    if (options.url) {
      if (options.url.includes('error')) throw new Error('yikes')
      if (options.url.includes('code')) throw { statusCode: 500, message: 'Code' }
      if (options.url.includes('missing')) throw { statusCode: 404 }
    }
    const file = options.url.includes('solrsearch') ? 'swt-3.3.0-v3346.json' : pickArtifact(options.url)
    const content = fs.readFileSync(`test/fixtures/maven/${file}`)
    return options.json ? JSON.parse(content) : content
  }
  const getStub = (url, callback) => {
    const response = new PassThrough()
    const file = `test/fixtures/maven/${pickArtifact(url)}`
    if (file) {
      response.write(fs.readFileSync(file))
      callback(null, { statusCode: 200 })
    } else {
      callback(new Error(url.includes('error') ? 'Error' : 'Code'))
    }
    response.end()
    return response
  }

  return MavenFetch({
    logger: { log: sinon.stub() },
    requestPromise: requestPromiseStub,
    requestStream: getStub
  })
}