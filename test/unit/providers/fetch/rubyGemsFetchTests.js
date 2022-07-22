const expect = require('chai').expect
const fs = require('fs')
const sinon = require('sinon')
const { promisify } = require('util')
const RubyGemsFetch = require('../../../../providers/fetch/rubyGemsFetch')
const Request = require('../../../../ghcrawler/lib/request.js')

describe('rubyGemsFetch', () => {
  let fetch
  beforeEach(() => {
    fetch = RubyGemsFetch({ logger: { info: sinon.stub() } })
    fetch._getRegistryData = sinon.stub().resolves({
      name: 'small',
      version: '0.5.1',
      gem_uri: 'https://rubygems.org/gems/small-0.5.1.gem',
    })
    fetch._getPackage = sinon.stub().callsFake((spec, destination) =>
      getPacakgeStub('test/fixtures/ruby/small-0.5.1.gem', destination))
  })

  function verifyFetch(result) {
    expect(result.url).to.be.equal('cd:/ruby/rubygems/-/small/0.5.1')
    expect(result.casedSpec.toUrl()).to.be.equal('cd:/ruby/rubygems/-/small/0.5.1')
    expect(result.document.hashes).to.be.deep.equal({
      sha1: 'f343d34992fffa1e4abbb1a2bfae45fcf49123ba',
      sha256: '2b5e4ba4e915e897d6fe9392c1cd1f5a21f8e7963679fb23f0a1953124772da0'
    })
    expect(result.document.releaseDate).to.contain('2012-05-21')
  }

  it('fetch spec with version', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/ruby/rubygems/-/small/0.5.1'))
    verifyFetch(result.fetchResult)
  })

  it('fetch spec without version', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/ruby/rubygems/-/small'))
    verifyFetch(result.fetchResult)
  })
})

const getPacakgeStub = async (file, destination) => {
  await promisify(fs.copyFile)(file, destination)
}