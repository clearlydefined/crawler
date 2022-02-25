// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const spies = require('chai-spies')
const sinon = require('sinon')
const fs = require('fs')
const PassThrough = require('stream').PassThrough
const Request = require('../../../../ghcrawler').request
const { promisify } = require('util')

chai.use(spies)
const expect = chai.expect

const FetchDispatcher = require('../../../../providers/fetch/dispatcher')
const MavenFetch = require('../../../../providers/fetch/mavencentralFetch')
const GitCloner = require('../../../../providers/fetch/gitCloner')
const PypiFetch = require('../../../../providers/fetch/pypiFetch')

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

  let resultCache
  let inProgressPromiseCache

  beforeEach(() => {
    resultCache = {}
    inProgressPromiseCache = {}
  })

  afterEach(() => {
    Object.values(resultCache).forEach(fetched => fetched.cleanup())
  })

  describe('cache maven fetch result', () => {
    let fetchDispatcher

    beforeEach(() => {
      fetchDispatcher = setupDispatcher(setupMavenFetch(), resultCache, inProgressPromiseCache)
    })

    it('cached result same as fetched', async () => {
      const fetched = await fetchDispatcher.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/swt/3.3.0-v3344'))

      expect(Object.keys(resultCache).length).to.be.equal(1)
      expect(Object.keys(inProgressPromiseCache).length).to.be.equal(0)
      const { cleanups, ...expected } = fetched
      expect(cleanups.length).to.be.equal(1)

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

  describe('cache gitClone fetch result', () => {
    let fetchDispatcher

    beforeEach(() => {
      const gitCloner = GitCloner({ logger: { log: sinon.stub() } })
      gitCloner._cloneRepo = sinon.stub().resolves(532)
      gitCloner._getRevision = sinon.stub().resolves('deef80a18aa929943e5dab1dba7276c231c84519')
      gitCloner._getDate = sinon.stub().resolves(new Date('2021-04-08T13:27:49.000Z'))
      fetchDispatcher = setupDispatcher(gitCloner, resultCache, inProgressPromiseCache)
    })

    it('cached result same as fetched', async () => {
      const fetched = await fetchDispatcher.handle(new Request('licensee', 'cd:git/github/palantir/refreshable/2.0.0'))
      expect(Object.keys(resultCache).length).to.be.equal(1)
      expect(Object.keys(inProgressPromiseCache).length).to.be.equal(0)

      fetchDispatcher._fetchPromise = sinon.stub().rejects('should not be called')
      const resultFromCache = await fetchDispatcher.handle(new Request('licensee', 'cd:git/github/palantir/refreshable/2.0.0'))
      expect(resultFromCache).to.be.deep.equal(fetched)
    })
  })

  describe('cache pypi fetch result', () => {
    let pypiFetch

    beforeEach(() => {
      pypiFetch = PypiFetch({ logger: { log: sinon.stub() } })
      pypiFetch._getPackage = sinon.stub().callsFake(async (spec, registryData, destination) => {
        const file = 'test/fixtures/maven/swt-3.3.0-v3346.jar'
        const content = await promisify(fs.readFile)(file)
        await promisify(fs.writeFile)(destination, content)
      })
    })

    it('cached result same as fetched', async () => {
      pypiFetch._getRegistryData = sinon.stub().resolves(JSON.parse(fs.readFileSync('test/fixtures/pypi/registryData.json')))
      const fetchDispatcher = setupDispatcher(pypiFetch, resultCache, inProgressPromiseCache)

      const fetched = await fetchDispatcher.handle(new Request('licensee', 'cd:/pypi/pypi/-/backports.ssl-match-hostname/3.7.0.1'))
      expect(Object.keys(resultCache).length).to.be.equal(1)
      expect(Object.keys(inProgressPromiseCache).length).to.be.equal(0)
      const { cleanups, ...expected } = fetched
      expect(cleanups.length).to.be.equal(1)

      fetchDispatcher._fetchPromise = sinon.stub().rejects('should not be called')
      const resultFromCache = await fetchDispatcher.handle(new Request('licensee', 'cd:/pypi/pypi/-/backports.ssl-match-hostname/3.7.0.1'))
      expect(resultFromCache).to.be.deep.equal(expected)
    })

    it('no cache for missing package', async () => {
      pypiFetch._getRegistryData = sinon.stub().resolves(null)
      const fetchDispatcher = setupDispatcher(pypiFetch, resultCache, inProgressPromiseCache)

      const fetched = await fetchDispatcher.handle(new Request('licensee', 'cd:/pypi/pypi/-/test/revision'))
      expect(fetched.processControl).to.be.equal('skip')
      expect(Object.keys(resultCache).length).to.be.equal(0)
      expect(Object.keys(inProgressPromiseCache).length).to.be.equal(0)
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