// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const spies = require('chai-spies')
const sinon = require('sinon')
const fs = require('fs')
const PassThrough = require('stream').PassThrough
const proxyquire = require('proxyquire')

const Request = require('../../../../ghcrawler').request
const { promisify } = require('util')

chai.use(spies)
const expect = chai.expect

const FetchDispatcher = require('../../../../providers/fetch/dispatcher')
const MavenFetch = require('../../../../providers/fetch/mavencentralFetch')
const GitCloner = require('../../../../providers/fetch/gitCloner')
const PypiFetch = require('../../../../providers/fetch/pypiFetch')
const RubyGemsFetch = require('../../../../providers/fetch/rubyGemsFetch')
const PackagistFetch = require('../../../../providers/fetch/packagistFetch')

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

  function verifyFetchSuccess(resultCache, inProgressPromiseCache) {
    expect(Object.keys(resultCache).length).to.be.equal(1)
    expect(Object.keys(inProgressPromiseCache).length).to.be.equal(0)
  }

  function verifyFetchFailure(resultCache, inProgressPromiseCache) {
    expect(Object.keys(resultCache).length).to.be.equal(0)
    expect(Object.keys(inProgressPromiseCache).length).to.be.equal(0)
  }

  function verifyFetchResult(fetched, resultFromCache) {
    // eslint-disable-next-line no-unused-vars
    const { cleanups, ...expected } = fetched
    expect(resultFromCache).to.be.deep.equal(expected)
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
      verifyFetchSuccess(resultCache, inProgressPromiseCache)

      fetchDispatcher._fetchPromise = sinon.stub().rejects('should not be called')
      const resultFromCache = await fetchDispatcher.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/swt/3.3.0-v3344'))
      verifyFetchResult(fetched, resultFromCache)
    })

    it('no cache for missing maven fetch', async () => {
      const fetched = await fetchDispatcher.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/swt'))
      expect(fetched.processControl).to.be.equal('skip')
      verifyFetchFailure(resultCache, inProgressPromiseCache)
    })

    it('no cache for failed maven fetch', async () => {
      try {
        await fetchDispatcher.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/error/3.3.0-v3344'))
        expect(false).to.be.true
      } catch (error) {
        expect(error.message).to.be.equal('yikes')
        verifyFetchFailure(resultCache, inProgressPromiseCache)
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
      verifyFetchSuccess(resultCache, inProgressPromiseCache)

      fetchDispatcher._fetchPromise = sinon.stub().rejects('should not be called')
      const resultFromCache = await fetchDispatcher.handle(new Request('licensee', 'cd:git/github/palantir/refreshable/2.0.0'))
      verifyFetchResult(fetched, resultFromCache)
    })
  })

  describe('cache pypi fetch result', () => {
    let pypiFetch

    beforeEach(() => {
      pypiFetch = PypiFetch({ logger: { log: sinon.stub() } })
      pypiFetch._getPackage = sinon.stub().callsFake(async (spec, registryData, destination) =>
        await getPacakgeStub('test/fixtures/maven/swt-3.3.0-v3346.jar', destination))
    })

    it('cached result same as fetched', async () => {
      pypiFetch._getRegistryData = sinon.stub().resolves(JSON.parse(fs.readFileSync('test/fixtures/pypi/registryData.json')))
      const fetchDispatcher = setupDispatcher(pypiFetch, resultCache, inProgressPromiseCache)

      const fetched = await fetchDispatcher.handle(new Request('licensee', 'cd:/pypi/pypi/-/backports.ssl-match-hostname/3.7.0.1'))
      verifyFetchSuccess(resultCache, inProgressPromiseCache)

      fetchDispatcher._fetchPromise = sinon.stub().rejects('should not be called')
      const resultFromCache = await fetchDispatcher.handle(new Request('licensee', 'cd:/pypi/pypi/-/backports.ssl-match-hostname/3.7.0.1'))
      verifyFetchResult(fetched, resultFromCache)
    })

    it('no cache for missing package', async () => {
      pypiFetch._getRegistryData = sinon.stub().resolves(null)
      const fetchDispatcher = setupDispatcher(pypiFetch, resultCache, inProgressPromiseCache)

      const fetched = await fetchDispatcher.handle(new Request('licensee', 'cd:/pypi/pypi/-/test/revision'))
      expect(fetched.processControl).to.be.equal('skip')
      verifyFetchFailure(resultCache, inProgressPromiseCache)
    })
  })

  describe('cache npm fetch result', () => {
    let fetchDispatcher

    beforeEach(() => {
      const NpmFetch = proxyquire('../../../../providers/fetch/npmjsFetch', {
        'request-promise-native': npmRegistryRequestStub
      })
      const npmFetch = NpmFetch({ logger: { log: sinon.stub() } })
      npmFetch._getPackage = sinon.stub().callsFake(async (spec, destination) =>
        await getPacakgeStub('test/fixtures/npm/redie-0.3.0.tgz', destination))

      fetchDispatcher = setupDispatcher(npmFetch, resultCache, inProgressPromiseCache)
    })

    it('cached result same as fetched', async () => {
      const fetched = await fetchDispatcher.handle(new Request('licensee', 'cd:/npm/npmjs/-/redie/0.3.0'))
      verifyFetchSuccess(resultCache, inProgressPromiseCache)

      fetchDispatcher._fetchPromise = sinon.stub().rejects('should not be called')
      const resultFromCache = await fetchDispatcher.handle(new Request('licensee', 'cd:/npm/npmjs/-/redie/0.3.0'))
      verifyFetchResult(fetched, resultFromCache)
    })
  })

  describe('cache rubyGems fetch result', () => {
    let fetchDispatcher

    beforeEach(() => {
      const rubyGemsFetch = RubyGemsFetch({ logger: { log: sinon.stub() } })
      rubyGemsFetch._getRegistryData = sinon.stub().resolves({
        name: 'small',
        version: '0.5.1',
        gem_uri: 'https://rubygems.org/gems/small-0.5.1.gem',
      })
      rubyGemsFetch._getPackage = sinon.stub().callsFake(async (spec, registryData, destination) =>
        await getPacakgeStub('test/fixtures/ruby/small-0.5.1.gem', destination))

      fetchDispatcher = setupDispatcher(rubyGemsFetch, resultCache, inProgressPromiseCache)
    })

    it('cached result same as fetched', async () => {
      const fetched = await fetchDispatcher.handle(new Request('test', 'cd:/ruby/rubygems/-/small/0.5.1'))
      verifyFetchSuccess(resultCache, inProgressPromiseCache)

      fetchDispatcher._fetchPromise = sinon.stub().rejects('should not be called')
      const resultFromCache = await fetchDispatcher.handle(new Request('test', 'cd:/ruby/rubygems/-/small/0.5.1'))
      verifyFetchResult(fetched, resultFromCache)
    })
  })

  describe('cache packagistFetch result', () => {
    let fetchDispatcher

    beforeEach(() => {
      const packagistFetch = PackagistFetch({ logger: { log: sinon.stub() } })
      packagistFetch._getRegistryData = sinon.stub().resolves(
        JSON.parse(fs.readFileSync('test/fixtures/packagist/registryData.json')))
      packagistFetch._getPackage = sinon.stub().callsFake(async (spec, registryData, destination) =>
        await getPacakgeStub('test/fixtures/composer/symfony-polyfill-mbstring-v1.11.0-0-gfe5e94c.zip', destination))

      fetchDispatcher = setupDispatcher(packagistFetch, resultCache, inProgressPromiseCache)
    })
    it('cached result same as fetched', async () => {
      const fetched = await fetchDispatcher.handle(new Request('test', 'cd:/composer/packagist/symfony/polyfill-mbstring/1.11.0'))
      verifyFetchSuccess(resultCache, inProgressPromiseCache)

      fetchDispatcher._fetchPromise = sinon.stub().rejects('should not be called')
      const resultFromCache = await fetchDispatcher.handle(new Request('test', 'cd:/composer/packagist/symfony/polyfill-mbstring/1.11.0'))
      verifyFetchResult(fetched, resultFromCache)
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

const getPacakgeStub = async (file, destination) => {
  const content = await promisify(fs.readFile)(file)
  await promisify(fs.writeFile)(destination, content)
}

const npmRegistryRequestStub = () => {
  const version = '0.3.0'
  return {
    manifest: { version },
    versions: { [version]: { test: true } },
    time: { [version]: '42' }
  }
}