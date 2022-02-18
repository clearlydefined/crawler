const expect = require('chai').expect
const sinon = require('sinon')
const fs = require('fs')
const proxyquire = require('proxyquire')

const Request = require('../../../../ghcrawler/lib/request.js')

describe('podFetch', () => {

  const loadJson = fileName => {
    return JSON.parse(fs.readFileSync(`test/fixtures/pod/${fileName}`))
  }

  const PodFetch = proxyquire('../../../../providers/fetch/podFetch', {
    requestretry: {
      defaults: () => {
        return {
          get: sinon.stub().resolves({ body: loadJson('versions.json'), statusCode: 200 })
        }
      }
    },
    'request-promise-native': sinon.stub().resolves(loadJson('registryData.json'))
  })

  let fetch

  beforeEach(() => {
    fetch = PodFetch({ logger: { info: sinon.stub() } })
    fetch._getPackage = sinon.stub().resolves('/tmp/cd-pYKk9q/SwiftLCS-1.0')
  })

  it('spec with version', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/pod/cocoapods/-/SwiftLCS/1.0'))
    result.fetchResult.copyTo(result)
    expect(result.url).to.be.equal('cd:/pod/cocoapods/-/SwiftLCS/1.0')
    expect(result.document.location).to.be.a.string
    expect(result.document.registryData.name).to.be.equal('SwiftLCS')
    expect(result.document.releaseDate).to.be.equal('2015-10-19 01:36:36 UTC')
    expect(result.casedSpec.toUrl()).to.be.equal('cd:/pod/cocoapods/-/SwiftLCS/1.0')
  })

  it('spec without version', async () => {
    const result = await fetch.handle(new Request('test', 'cd:/pod/cocoapods/-/SwiftLCS'))
    result.fetchResult.copyTo(result)
    expect(result.url).to.be.equal('cd:/pod/cocoapods/-/SwiftLCS/1.3.4')
    expect(result.document.releaseDate).to.be.equal('2019-04-10 00:22:10 UTC')
    expect(result.casedSpec.toUrl()).to.be.equal('cd:/pod/cocoapods/-/SwiftLCS/1.3.4')
  })
})