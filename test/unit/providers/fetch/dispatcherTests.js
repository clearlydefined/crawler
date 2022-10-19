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

  let resultCache
  let inProgressPromiseCache

  beforeEach(() => {
    resultCache = {}
    inProgressPromiseCache = {}
  })

  afterEach(() => {
    Object.values(resultCache).forEach(fetched => fetched.cleanup())
  })

  function setupDispatcher(fetcher) {
    const storeStub = { get: () => null }
    const processorsStub = [{ canHandle: () => true, shouldFetch: () => true, getUrnFor: () => 'documentkey' }]
    const filterStub = { shouldFetchMissing: () => true, shouldFetch: () => true }
    const options = { logger: { info: sinon.stub(), debug: sinon.stub() } }
    return FetchDispatcher(options, storeStub, [fetcher], processorsStub, filterStub, mockResultCache(resultCache), inProgressPromiseCache)
  }

  function mockResultCache(cache) {
    return {
      get: key => cache[key],
      setWithConditionalExpiry : (key, value) => cache[key] = value,
    }
  }

  async function verifyFetchAndCache(fetchDispatcher, url) {
    const fetched = await fetchDispatcher.handle(new Request('test', url))
    verifyFetchSuccess()

    fetchDispatcher._fetchPromise = sinon.stub().rejects('should not be called')
    const resultFromCache = await fetchDispatcher.handle(new Request('test', url))
    verifyFetchResult(fetched, resultFromCache)
  }

  function verifyFetchSuccess() {
    expect(Object.keys(resultCache).length).to.be.equal(1)
    expect(Object.keys(inProgressPromiseCache).length).to.be.equal(0)
  }

  function verifyFetchFailure() {
    expect(Object.keys(resultCache).length).to.be.equal(0)
    expect(Object.keys(inProgressPromiseCache).length).to.be.equal(0)
  }

  function verifyFetchResult(fetched, resultFromCache) {
    // eslint-disable-next-line no-unused-vars
    const { cleanups, ...expected } = fetched
    // eslint-disable-next-line no-unused-vars
    const { cleanups: cleanupsCached, ...actual } = resultFromCache
    expect(actual).to.be.deep.equal(expected)
  }

  describe('cache maven fetch result', () => {
    function setupMavenFetch() {
      const fileSupplier = url => {
        let fileName
        if (url.includes('solrsearch')) fileName = 'swt-3.3.0-v3346.json'
        if (url.endsWith('.pom')) fileName = 'swt-3.3.0-v3346.pom'
        if (url.endsWith('-sources.jar')) fileName = 'swt-3.3.0-v3346.jar'
        if (url.endsWith('.jar')) fileName = 'swt-3.3.0-v3346.jar'
        return `/maven/${fileName}`
      }
      return MavenFetch({
        logger: { log: sinon.stub() },
        requestPromise: createRequestPromiseStub(fileSupplier),
        requestStream: createGetStub(fileSupplier)
      })
    }

    let fetchDispatcher

    beforeEach(() => {
      fetchDispatcher = setupDispatcher(setupMavenFetch())
    })

    it('cached result same as fetched', async () => {
      await verifyFetchAndCache(fetchDispatcher, 'cd:/maven/mavencentral/org.eclipse/swt/3.3.0-v3344')
    })

    it('no cache for missing maven fetch', async () => {
      const fetched = await fetchDispatcher.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/swt'))
      expect(fetched.processControl).to.be.equal('skip')
      verifyFetchFailure()
    })

    it('no cache for failed maven fetch', async () => {
      try {
        await fetchDispatcher.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/error/3.3.0-v3344'))
        expect(false).to.be.true
      } catch (error) {
        expect(error.message).to.be.equal('yikes')
        verifyFetchFailure()
      }
    })
  })

  describe('cache GitCloner fetch result', () => {
    let fetchDispatcher

    beforeEach(() => {
      const gitCloner = GitCloner({ logger: { log: sinon.stub() } })
      gitCloner._cloneRepo = sinon.stub().resolves(532)
      gitCloner._getRevision = sinon.stub().resolves('deef80a18aa929943e5dab1dba7276c231c84519')
      gitCloner._getDate = sinon.stub().resolves(new Date('2021-04-08T13:27:49.000Z'))
      fetchDispatcher = setupDispatcher(gitCloner)
    })

    it('cached result same as fetched', async () => {
      await verifyFetchAndCache(fetchDispatcher, 'cd:git/github/palantir/refreshable/2.0.0')
    })
  })

  describe('cache PypiFetch result', () => {
    let pypiFetch

    beforeEach(() => {
      pypiFetch = PypiFetch({ logger: { log: sinon.stub() } })
      pypiFetch._getPackage = sinon.stub().callsFake(async (spec, registryData, destination) => {
        await getPacakgeStub('test/fixtures/maven/swt-3.3.0-v3346.jar', destination)
        return true
      })
    })

    it('cached result same as fetched', async () => {
      pypiFetch._getRegistryData = sinon.stub().resolves(JSON.parse(fs.readFileSync('test/fixtures/pypi/registryData.json')))
      const fetchDispatcher = setupDispatcher(pypiFetch)
      await verifyFetchAndCache(fetchDispatcher, 'cd:/pypi/pypi/-/backports.ssl-match-hostname/3.7.0.1')
    })

    it('no cache for missing package', async () => {
      pypiFetch._getRegistryData = sinon.stub().resolves(null)
      const fetchDispatcher = setupDispatcher(pypiFetch)

      const fetched = await fetchDispatcher.handle(new Request('licensee', 'cd:/pypi/pypi/-/test/revision'))
      expect(fetched.processControl).to.be.equal('skip')
      verifyFetchFailure()
    })
  })

  describe('cache NpmFetch result', () => {

    const npmRegistryRequestStub = () => {
      const version = '0.3.0'
      return {
        manifest: { version },
        versions: { [version]: { test: true } },
        time: { [version]: '42' }
      }
    }

    let fetchDispatcher

    beforeEach(() => {
      const NpmFetch = proxyquire('../../../../providers/fetch/npmjsFetch', {
        'request-promise-native': npmRegistryRequestStub
      })
      const npmFetch = NpmFetch({ logger: { log: sinon.stub() } })
      npmFetch._getPackage = sinon.stub().callsFake(async (spec, destination) =>
        await getPacakgeStub('test/fixtures/npm/redie-0.3.0.tgz', destination))

      fetchDispatcher = setupDispatcher(npmFetch)
    })

    it('cached result same as fetched', async () => {
      await verifyFetchAndCache(fetchDispatcher, 'cd:/npm/npmjs/-/redie/0.3.0')
    })
  })

  describe('cache RubyGemsFetch result', () => {
    let fetchDispatcher

    beforeEach(() => {
      const rubyGemsFetch = RubyGemsFetch({ logger: { log: sinon.stub() } })
      rubyGemsFetch._getRegistryData = sinon.stub().resolves({
        name: 'small',
        version: '0.5.1',
        gem_uri: 'https://rubygems.org/gems/small-0.5.1.gem',
      })
      rubyGemsFetch._getPackage = sinon.stub().callsFake(async (spec, destination) =>
        await getPacakgeStub('test/fixtures/ruby/small-0.5.1.gem', destination))

      fetchDispatcher = setupDispatcher(rubyGemsFetch)
    })

    it('cached result same as fetched', async () => {
      await verifyFetchAndCache(fetchDispatcher, 'cd:/gem/rubygems/-/small/0.5.1')
    })
  })

  describe('cache PackagistFetch result', () => {
    let fetchDispatcher

    beforeEach(() => {
      const packagistFetch = PackagistFetch({ logger: { log: sinon.stub() } })
      packagistFetch._getRegistryData = sinon.stub().resolves(
        JSON.parse(fs.readFileSync('test/fixtures/packagist/registryData.json')))
      packagistFetch._getPackage = sinon.stub().callsFake(async (spec, registryData, destination) =>
        await getPacakgeStub('test/fixtures/composer/symfony-polyfill-mbstring-v1.11.0-0-gfe5e94c.zip', destination))

      fetchDispatcher = setupDispatcher(packagistFetch)
    })

    it('cached result same as fetched', async () => {
      await verifyFetchAndCache(fetchDispatcher, 'cd:/composer/packagist/symfony/polyfill-mbstring/1.11.0')
    })
  })

  describe('cache CrateioFetch result', () => {
    const requestPromiseStub = options => {
      const body = fs.readFileSync('test/fixtures/crates/bitflags.json')
      if (options && options.json) return JSON.parse(body)
      const response = new PassThrough()
      response.write(fs.readFileSync('test/fixtures/crates/bitflags-1.0.4.crate'))
      response.statusCode = 200
      response.end()
      return response
    }

    let fetchDispatcher

    beforeEach(() => {
      const CrateioFetch = proxyquire('../../../../providers/fetch/cratesioFetch', {
        'request-promise-native': requestPromiseStub
      })
      const packagistFetch = CrateioFetch({ logger: { log: sinon.stub() } })
      fetchDispatcher = setupDispatcher(packagistFetch)
    })

    it('cached result same as fetched', async () => {
      await verifyFetchAndCache(fetchDispatcher, 'cd:/crate/cratesio/-/bitflags/1.0.4')
    })
  })

  describe('cache DebianFetch result', () => {
    const memCacheStub = { get: () => true }
    let fetchDispatcher

    beforeEach(() => {
      const DebianFetch = proxyquire('../../../../providers/fetch/debianFetch', {
        'memory-cache': memCacheStub
      })
      const fetch = DebianFetch({ logger: { info: sinon.stub() }, cdFileLocation: 'test/fixtures/debian/fragment' })
      fetch._download = async (downloadUrl, destination) =>
        getPacakgeStub('test/fixtures/debian/0ad_0.0.17-1_armhf.deb', destination)
      fetch._getDeclaredLicenses = async () => {
        return ['MIT', 'BSD-3-clause']
      }
      fetchDispatcher = setupDispatcher(fetch)
    })

    it('cached result same as fetched', async () => {
      await verifyFetchAndCache(fetchDispatcher, 'cd:/deb/debian/-/0ad/0.0.17-1_armhf')
    })
  })

  describe('cache GoFetch result', () => {
    function fileSupplier(url) {
      const fileName = url.endsWith('.info') ? 'v1.3.0.info' : 'v1.3.0.zip'
      return `/go/${fileName}`
    }

    let fetchDispatcher

    beforeEach(() => {
      const GoFetch = proxyquire('../../../../providers/fetch/goFetch', {
        request: { get: createGetStub(fileSupplier) },
        'request-promise-native': createRequestPromiseStub(fileSupplier)
      })
      const fetch = GoFetch({ logger: { info: sinon.stub() } })
      fetchDispatcher = setupDispatcher(fetch)
    })

    it('cached result same as fetched', async () => {
      await verifyFetchAndCache(fetchDispatcher, 'cd:/go/golang/rsc.io/quote/v1.3.0')
    })
  })

  describe('cache NugetFetch result', () => {
    const fileSupplier = (url) => {
      let fileName = null
      if (url.includes('catalog')) fileName = 'xunit.core.2.4.1.catalog.json'
      if (url.endsWith('index.json')) fileName = 'xunit.core.index.json'
      if (url.endsWith('.json')) fileName = 'xunit.core.2.4.1.json'
      if (url.endsWith('.nuspec')) fileName = 'xunit.core.2.4.1.nuspec'
      if (url.endsWith('.nupkg')) fileName = 'xunit.core.2.4.1.nupkg'
      if (url.endsWith('license.txt')) fileName = 'license.txt'
      return `nuget/${fileName}`
    }

    const requestPromiseStub = (url, options) => {
      const body = fs.readFileSync(`test/fixtures/${fileSupplier(url)}`)
      if (options?.json) return { body: JSON.parse(body), statusCode: 200 }
      const response = new PassThrough()
      response.body = body
      response.write(body)
      response.statusCode = 200
      response.end()
      return response
    }

    let fetchDispatcher

    beforeEach(() => {
      const NugetFetch = proxyquire('../../../../providers/fetch/nugetFetch', {
        requestretry: {
          defaults: () => {
            return { get: requestPromiseStub }
          }
        }
      })
      const fetch = NugetFetch({ logger: { info: sinon.stub() } })
      fetchDispatcher = setupDispatcher(fetch)
    })
    it('cached result same as fetched', async () => {
      await verifyFetchAndCache(fetchDispatcher, 'cd:/nuget/nuget/-/xunit.core/2.4.1')
    })
  })

  describe('cache PodFetch result', () => {
    let fetchDispatcher

    beforeEach(() => {
      const PodFetch = proxyquire('../../../../providers/fetch/podFetch', {
        requestretry: {
          defaults: () => {
            return { get: sinon.stub().resolves({ body: loadJson('pod/versions.json'), statusCode: 200 }) }
          }
        },
        'request-promise-native': sinon.stub().resolves(loadJson('pod/registryData.json'))
      })
      const fetch = PodFetch({ logger: { info: sinon.stub() } })
      fetchDispatcher = setupDispatcher(fetch)
    })

    it('cached result same as fetched', async () => {
      await verifyFetchAndCache(fetchDispatcher, 'cd:/pod/cocoapods/-/SwiftLCS/1.0')
    })
  })
})

const createRequestPromiseStub = fileSupplier => {
  return options => {
    if (options.url) {
      if (options.url.includes('error')) throw new Error('yikes')
      if (options.url.includes('code')) throw { statusCode: 500, message: 'Code' }
      if (options.url.includes('missing')) throw { statusCode: 404 }
    }
    const content = fs.readFileSync(`test/fixtures/${fileSupplier(options.url)}`)
    return options.json ? JSON.parse(content) : content
  }
}

const createGetStub = fileSupplier => {
  return (url, callback) => {
    const response = new PassThrough()
    const file = `test/fixtures/${fileSupplier(url)}`
    if (file) {
      response.write(fs.readFileSync(file))
      callback(null, { statusCode: 200 })
    } else {
      callback(new Error(url.includes('error') ? 'Error' : 'Code'))
    }
    response.end()
    return response
  }
}

const getPacakgeStub = async (file, destination) => {
  await promisify(fs.copyFile)(file, destination)
}

const loadJson = fileName => {
  return JSON.parse(fs.readFileSync(`test/fixtures/${fileName}`))
}