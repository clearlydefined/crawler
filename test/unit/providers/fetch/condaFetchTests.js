const expect = require('chai').expect
const fs = require('fs')
const sinon = require('sinon')
const { promisify } = require('util')
const CondaFetch = require('../../../../providers/fetch/condaFetch.js')
const Request = require('../../../../ghcrawler/lib/request.js')

describe('condaFetch utilities', () => {
  let fetch = CondaFetch({
    logger: { info: sinon.stub() },
    cdFileLocation: 'test/fixtures/conda/fragment'
  })

  let repoData = JSON.parse(fs.readFileSync('test/fixtures/conda/repodata.json'))

  it('matches packages in repodata.packages correctly', () => {
    expect(fetch._matchPackage('21cmfast', '3.0.2', null, repoData).length).to.greaterThan(0)
  })

  it('matches packages in repodata.packages.conda correctly', () => {
    expect(fetch._matchPackage('21cmfast', '3.0.2', 'py37h48b2cff_0', repoData).length).to.greaterThan(0)
    expect(fetch._matchPackage('21cmfast', '3.0.2', 'py37h48b2cff_0', repoData)[0].packageData.build).to.equal('py37h48b2cff_0')
  })

  it('matches the latest package when version not specified', () => {
    expect(fetch._matchPackage('21cmfast', null, null, repoData)[0].packageData.timestamp).to.equal(1605110689658)
  })

  it('matches the latest package when version specified', () => {
    expect(fetch._matchPackage('21cmfast', '3.0.2', null, repoData)[0].packageData.timestamp).to.equal(1605110689658)
  })
})

describe('condaFetch', () => {
  let fetch
  beforeEach(() => {
    fetch = CondaFetch({
      logger: { info: sinon.stub() },
      cdFileLocation: 'test/fixtures/conda/fragment'
    })
    fetch.getChannelData = sinon.stub().resolves(
      JSON.parse(fs.readFileSync('test/fixtures/conda/channeldata.json'))
    )

    fetch.getRepoData = sinon.stub().resolves(
      JSON.parse(fs.readFileSync('test/fixtures/conda/repodata.json'))
    )

    fetch._downloadPackage = sinon.stub().callsFake((downloadUrl, destination) => {
      expect(downloadUrl).to.contains('https://conda.anaconda.org/conda-forge/')
      expect(downloadUrl).to.contains('21cmfast-3.0.2-py')
      return downloadPackageStub('test/fixtures/conda/21cmfast-3.0.2-py37hd45b216_1.tar.bz2', destination)
    })
  })

  function verifyFetch(result) {
    expect(result.url).to.be.contains('cd:/conda/conda-forge/linux-64/21cmfast/3.0.2')
    expect(result.document.hashes).to.be.deep.equal({
      sha1: '9b2f4958826956be03cf3793dbdb663a53a8a1f1',
      sha256: '1154fceeb5c4ee9bb97d245713ac21eb1910237c724d2b7103747215663273c2'
    })
    expect(result.document.location).to.be.a.string
    expect(result.document.releaseDate).to.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/)
    expect(result.document.declaredLicenses).to.equal('MIT')
  }

  it('can handle conda providers', () => {
    expect(fetch.canHandle(new Request('test', 'cd:/conda/conda-forge/-/21cmfast/'))).to.be.true
    expect(fetch.canHandle(new Request('test', 'cd:/conda/anaconda-main/-/numpy/'))).to.be.true
    expect(fetch.canHandle(new Request('test', 'cd:/conda/anaconda-r/-/r/'))).to.be.true
  })

  it('rejects invalid spec type', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/invalid/conda-forge/-/21cmfast/'))
    expect(result.outcome).to.equal('spec type must either be conda or condasrc')
  })

  it('reports missing packages', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/linux-64/invalid_package/'))
    expect(result.outcome).to.equal('Missing package invalid_package in channel: conda-forge')
  })

  it('fetch package without version and architecture', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/-/21cmfast/'))
    verifyFetch(result.fetchResult)
  })

  it('fetch package with version and architecture sentinel', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/-/21cmfast/-'))
    verifyFetch(result.fetchResult)
  })

  it('fetch package with version and without architecture', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/-/21cmfast/3.0.2'))
    verifyFetch(result.fetchResult)
  })

  it('fetch package with version and architecture', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/linux-64/21cmfast/3.0.2'))
    verifyFetch(result.fetchResult)
  })

  it('reports missing architecture', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/xos-64/21cmfast/3.0.2'))
    expect(result.outcome).to.equal('Missing architecture xos-64 for package 21cmfast in channel')
  })

  it('fetch package with version, architecture, and build version', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/linux-64/21cmfast/3.0.2-py37hd45b216_1'))
    verifyFetch(result.fetchResult)
  })

  it('fetch package with architecture and build version', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/linux-64/21cmfast/-py37hd45b216_1'))
    verifyFetch(result.fetchResult)
  })

  it('reports failed package matching', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/linux-64/21cmfast/3.0.2-py9999_invalid'))
    expect(result.outcome).to.equal('Missing package with matching spec (version: 3.0.2, buildVersion: py9999_invalid) in linux-64 repository')
  })

  it('reports failed repodata fetching and parsing', async () => {
    fetch.getRepoData = sinon.stub().resolves(null)
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/linux-64/21cmfast/3.0.2'))
    expect(result.outcome).to.equal('failed to fetch and parse repodata json file for channel conda-forge in architecture linux-64')
  })

  it('reports failed channeldata fetching and parsing', async () => {
    fetch.getChannelData = sinon.stub().resolves(null)
    const result = await fetch.handle(new Request('test', 'cd:/conda/conda-forge/linux-64/21cmfast/3.0.2'))
    expect(result.outcome).to.equal('failed to fetch and parse channelData.json')
  })
})

describe('condaSrcFetch', () => {
  let fetch
  beforeEach(() => {
    fetch = CondaFetch({
      logger: { info: sinon.stub() },
      cdFileLocation: 'test/fixtures/conda/fragment'
    })
    fetch.getChannelData = sinon.stub().resolves(
      JSON.parse(fs.readFileSync('test/fixtures/conda/channeldata.json'))
    )

    fetch.getRepoData = sinon.stub().resolves(
      JSON.parse(fs.readFileSync('test/fixtures/conda/repodata.json'))
    )

    fetch._downloadPackage = sinon.stub().callsFake((downloadUrl, destination) => {
      expect(downloadUrl).to.equal('https://pypi.io/packages/source/2/21cmFAST/21cmFAST-3.3.1.tar.gz')
      return downloadPackageStub('test/fixtures/conda/21cmFAST-3.3.1.tar.gz', destination)
    })
  })

  function verifyFetch(result) {
    expect(result.url).to.be.contains('cd:/condasrc/conda-forge/-/21cmfast/3.3.1')
    expect(result.document.hashes).to.be.deep.equal({
      sha1: '92ec2a84d2377426ff51ad3b07a75921245c8881',
      sha256: '96f5809d111a8a137c25758fa3f41586ea44cecba7ae191518767895afc7b3c6'
    })
    expect(result.document.location).to.be.a.string
    expect(result.document.releaseDate).to.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/)
    expect(result.document.declaredLicenses).to.equal('MIT')
  }

  it('fetch package without version', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/condasrc/conda-forge/-/21cmfast/'))
    verifyFetch(result.fetchResult)
  })

  it('fetch package with version', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/condasrc/conda-forge/-/21cmfast/3.3.1'))
    verifyFetch(result.fetchResult)
  })

  it('reports non-matching condasrc package versions', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/condasrc/conda-forge/-/21cmfast/6.6.2'))
    expect(result.outcome).to.equal('Missing source file version 6.6.2 for package 21cmfast')
  })

  it('reports missing source_url', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/condasrc/conda-forge/-/21cmfast_invalid/3.3.1'))
    expect(result.outcome).to.equal('Missing archive source file in repodata for package 21cmfast_invalid')
  })
})

const downloadPackageStub = async (file, destination) => {
  await promisify(fs.copyFile)(file, destination)
}