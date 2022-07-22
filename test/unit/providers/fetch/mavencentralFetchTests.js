// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const MavenFetch = require('../../../../providers/fetch/mavencentralFetch')
const PassThrough = require('stream').PassThrough
const Request = require('../../../../ghcrawler').request
const fs = require('fs')

const stub = 'https://search.maven.org/remotecontent?filepath='
describe('Maven Central utility functions', () => {
  afterEach(() => sinon.restore())

  it('builds URLs', () => {
    const fetch = MavenFetch({})
    expect(fetch._buildUrl(spec('maven', 'g1', 'a1', '1.2.3'), '.pom')).to.equal(stub + 'g1/a1/1.2.3/a1-1.2.3.pom')
    expect(fetch._buildUrl(spec('maven', 'g1', 'a1', '1.2.3'))).to.equal(stub + 'g1/a1/1.2.3/a1-1.2.3.jar')
    expect(fetch._buildUrl(spec('sourcearchive', 'g1', 'a1', '1.2.3'), '-sources.jar')).to.equal(
      stub + 'g1/a1/1.2.3/a1-1.2.3-sources.jar'
    )
    expect(fetch._buildUrl(spec('maven', 'com.g1', 'a1.foo', '1.2.3'))).to.equal(
      stub + 'com/g1/a1.foo/1.2.3/a1.foo-1.2.3.jar'
    )
    expect(fetch._buildUrl(spec('maven', 'g1', 'a1', '1.2.3'), '.jar')).to.equal(stub + 'g1/a1/1.2.3/a1-1.2.3.jar')
    expect(fetch._buildUrl(spec('maven', 'g1', 'a1', '1.2.3'), '.aar')).to.equal(stub + 'g1/a1/1.2.3/a1-1.2.3.aar')
  })

  it('merges poms', () => {
    const fetch = MavenFetch({})
    expect(fetch._mergePoms([dummyPom2, dummyPom1])).to.deep.equal(dummyMerged)
  })

  it('gets releaseDate from pomProperties', async () => {
    const fetch = MavenFetch({
      logger: { log: sinon.stub() },
      requestPromise: sinon.stub().resolves({})
    })
    sinon.replace(fs, 'exists', (loc, cb) => cb(true))
    sinon.replace(fs, 'readFile', (loc, cb) =>
      cb(null, '#Generated by Maven\n#Fri May 13 12:26:22 GMT+01:00 2011\ngroupId=g1\nartifactId=a1\nversion=1.2.3'))

    const date = await fetch._getReleaseDate('/tmp/', spec('maven', 'g1', 'a1', '1.2.3'))
    expect(date).to.eq('2011-05-13T11:26:22.000Z')
  })
})

function spec(type, namespace, name, revision) {
  return { type, provider: 'mavencentral', namespace, name, revision }
}

const hashes = {
  'swt-3.3.0-v3346.jar': {
    sha1: 'd886a6db6b7195911516896feebe3a5d1dddfd46',
    sha256: '18a3a53a27df164d4db56d0f7f5da2edd25995418d5538f40eb4018347fe1354'
  }
}

function pickArtifact(url) {
  if (url.endsWith('.pom')) return 'swt-3.3.0-v3346.pom'
  if (url.endsWith('-sources.jar')) return 'swt-3.3.0-v3346.jar'
  if (url.endsWith('.jar')) return 'swt-3.3.0-v3346.jar'
  return null
}

describe('MavenCentral fetching', () => {

  let handler

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

    handler = MavenFetch({
      logger: { log: sinon.stub() },
      requestPromise: requestPromiseStub,
      requestStream: getStub
    })
  })

  afterEach(function () {
    sinon.restore()
  })

  it('succeeds in download, decompress and hash', async () => {
    const request = await handler.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/swt/3.3.0-v3344'))
    expect(request.fetchResult.document.hashes.sha1).to.be.equal(hashes['swt-3.3.0-v3346.jar']['sha1'])
    expect(request.fetchResult.document.hashes.sha256).to.be.equal(hashes['swt-3.3.0-v3346.jar']['sha256'])
    //from query maven central
    expect(request.fetchResult.document.releaseDate).to.equal('2007-11-27T07:15:10.000Z')
    expect(request.fetchResult.casedSpec.name).to.equal('swt')
    expect(request.fetchResult.casedSpec.namespace).to.equal('org.eclipse')
    expect(request.fetchResult.document.location).to.be.a('string')
  })

  it('handles download error', async () => {
    handler._getPoms = () => [dummyPom1]
    handler.decompress = () => { }
    handler.computeHashes = () => { }
    handler.createTempDir = () => {
      return { name: '/tmp/' }
    }
    handler.createTempFile = () => {
      return {
        name: '/tmp/random'
      }
    }
    handler._getArtifact = () => { }
    try {
      const result = await handler.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/error/3.3.0-v3344'))
      expect(result.outcome).to.eq('Missing  ')
    } catch (error) {
      expect(true).to.be.equal(false)
    }
  })

  it('handles download with non-200 status code', async () => {
    try {
      await handler.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/code/3.3.0-v3344'))
      expect(false).to.be.true
    } catch (error) {
      expect(error.message).to.be.equal('Code')
    }
  })

  it('handles missing registry data getting latest version', async () => {
    handler._getLatestVersion = () => null
    const request = await handler.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/swt'))
    expect(request.processControl).to.be.equal('skip')
  })

  it('handles error getting registry data', async () => {
    try {
      await handler.handle(new Request('test', 'cd:/maven/mavencentral/org.eclipse/error/3.3.0-v3344'))
      expect(false).to.be.true
    } catch (error) {
      expect(error.message).to.be.equal('yikes')
    }
  })
})

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

const dummyMerged = {
  artifactId: ['swt'],
  groupId: ['org.eclipse'],
  licenses: [
    {
      license: [
        {
          name: ['Eclipse Public License - v 1.0'],
          url: ['http://www.eclipse.org/org/documents/epl-v10.html']
        }
      ]
    }
  ],
  modelVersion: ['4.0.0'],
  name: ['Standard Widget Toolkit'],
  version: ['3.3.0-v3346']
}