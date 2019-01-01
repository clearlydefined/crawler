// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const MavenFetch = require('../../../../providers/fetch/mavencentralFetch')
const EntitySpec = require('../../../../lib/entitySpec')
const PassThrough = require('stream').PassThrough
const proxyquire = require('proxyquire')
const Request = require('ghcrawler').request
const fs = require('fs')

const stub = 'https://search.maven.org/remotecontent?filepath='
describe('Maven Central utility functions', () => {
  it('builds URLs', () => {
    const fetch = MavenFetch({})
    expect(fetch._buildUrl(spec('maven', 'g1', 'a1', '1.2.3'), 'pom')).to.equal(stub + 'g1/a1/1.2.3/a1-1.2.3.pom')
    expect(fetch._buildUrl(spec('maven', 'g1', 'a1', '1.2.3'))).to.equal(stub + 'g1/a1/1.2.3/a1-1.2.3.jar')
    expect(fetch._buildUrl(spec('sourcearchive', 'g1', 'a1', '1.2.3'))).to.equal(
      stub + 'g1/a1/1.2.3/a1-1.2.3-sources.jar'
    )
    expect(fetch._buildUrl(spec('maven', 'com.g1', 'a1.foo', '1.2.3'))).to.equal(
      stub + 'com/g1/a1/foo/1.2.3/a1.foo-1.2.3.jar'
    )
  })
})

function spec(type, namespace, name, revision) {
  return { type, provider: 'mavencentral', namespace, name, revision }
}

let Fetch

const hashes = {
  'swt-3.3.0-v3346.jar': {
    sha1: 'd886a6db6b7195911516896feebe3a5d1dddfd46',
    sha256: '18a3a53a27df164d4db56d0f7f5da2edd25995418d5538f40eb4018347fe1354'
  }
}

function pickArtifact(url) {
  if (url.endsWith('.pom')) return 'swt-3.3.0-v3346.pom'
  if (url.endsWith('-sources.jar')) return 'swt-3.3.0-v3346-sources.jar'
  if (url.endsWith('.jar')) return 'swt-3.3.0-v3346.jar'
  return null
}

describe('MavenCentral fetching', () => {
  beforeEach(() => {
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
    Fetch = proxyquire('../../../../providers/fetch/mavencentralFetch', {
      request: { get: getStub },
      'request-promise-native': requestPromiseStub
    })
  })

  afterEach(function() {
    sinon.sandbox.restore()
  })

  it('succeeds in download, decompress and hash', async () => {
    const handler = Fetch({ logger: { log: sinon.stub() } })
    const request = await handler.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/swt/3.3.0-v3344'))
    expect(request.document.hashes.sha1).to.be.equal(hashes['swt-3.3.0-v3346.jar']['sha1'])
    expect(request.document.hashes.sha256).to.be.equal(hashes['swt-3.3.0-v3346.jar']['sha256'])
    expect(request.document.releaseDate).to.equal('2007-11-27T07:15:10.000Z')
    expect(request.document.registryData.a).to.equal('swt')
    expect(request.document.location).to.be.a('string')
  })
})

describe('MavenCentral error handling', () => {
  it('handles download error', async () => {
    const handler = setup()
    handler._getRegistryData = () => dummyRegistryData
    handler._getPoms = () => [dummyPom]
    handler.createTempFile = () => {}
    handler._getArtifact = () => {}
    try {
      await handler.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/error/3.3.0-v3344'))
      expect(false).to.be.true
    } catch (error) {
      expect(error.message).to.be.equal('yikes')
    }
  })

  it('handles download with non-200 status code', async () => {
    const handler = setup()
    try {
      await handler.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/code/3.3.0-v3344'))
      expect(false).to.be.true
    } catch (error) {
      expect(error.message).to.be.equal('Code')
    }
  })

  it('handles missing registry data', async () => {
    const handler = setup()
    handler._getRegistryData = () => null
    const request = await handler.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/swt/3.3.0-v3344'))
    expect(request.processControl).to.be.equal('skip')
  })

  it('handles error getting registry data', async () => {
    const handler = setup()
    try {
      await handler.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/error/3.3.0-v3344'))
      expect(false).to.be.true
    } catch (error) {
      expect(error.message).to.be.equal('yikes')
    }
  })
})

const dummyRegistryData = {
  docs: [
    {
      id: 'org.eclipse:swt:3.3.0-v3346',
      g: 'org.eclipse',
      a: 'swt',
      v: '3.3.0-v3346',
      p: 'jar',
      timestamp: 1196147710000,
      ec: ['.jar', '.pom']
    }
  ]
}

const dummyPom1 = {
  project: {
    modelVersion: ['4.0.0'],
    groupId: ['org.eclipse'],
    artifactId: ['swt'],
    name: ['Standard Widget Toolkit'],
    version: ['3.3.0-v3346'],
    licenses: [
      {
        license: [
          {
            name: ['Eclipse Public License - v 1.0'],
            url: ['http://www.eclipse.org/org/documents/epl-v10.html']
          }
        ]
      }
    ]
  }
}

const dummyPom2 = {
  project: {
    modelVersion: ['4.0.0'],
    groupId: ['org.eclipse'],
    artifactId: ['parent'],
    licenses: [
      {
        license: [
          {
            name: ['Eclipse Public License - v 1.0'],
            url: ['http://www.eclipse.org/org/documents/epl-v10.html']
          }
        ]
      }
    ]
  }
}

function setup() {
  const options = { logger: { log: sinon.stub() } }
  const handler = Fetch(options)
  return handler
}
