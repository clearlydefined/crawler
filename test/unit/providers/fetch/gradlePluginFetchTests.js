// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const fs = require('fs')
const sinon = require('sinon')
const PassThrough = require('stream').PassThrough
const GradlePluginFetch = require('../../../../providers/fetch/gradlePluginFetch')
const Request = require('../../../../ghcrawler').request

describe('Gradle plugin fetch', () => {

  describe('look up latest version in maven meta data', () => {
    const spec = {
      type: 'maven',
      provider: 'gradleplugin',
      namespace: 'io.github.lognet',
      name: 'grpc-spring-boot-starter-gradle-plugin'
    }

    it('get latest version from maven meta data', async () => {
      const gradleFetch = GradlePluginFetch({
        logger: { log: sinon.stub() },
        requestPromise: sinon.stub().resolves(fs.readFileSync('test/fixtures/maven/maven-metadata.xml'))
      })
      const latest = await gradleFetch._getLatestVersion(spec)
      expect(latest).to.be.eq('4.5.10')
    })

    it('no latest version', async () => {
      const gradleFetch = GradlePluginFetch({
        logger: { log: sinon.stub() },
        requestPromise: sinon.stub().resolves('')
      })
      const latest = await gradleFetch._getLatestVersion(spec)
      expect(latest).to.be.null
    })

    it('no maven meta data found', async () => {
      const gradleFetch = GradlePluginFetch({
        logger: { log: sinon.stub() },
        requestPromise: sinon.stub().rejects({ statusCode: 404 })
      })
      const latest = await gradleFetch._getLatestVersion(spec)
      expect(latest).to.be.null
    })
  })

  describe('fetch function', () => {
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
      if (url.endsWith('maven-metadata.xml')) return 'maven-metadata.xml'
      return null
    }

    function contentFromFile(url) {
      return fs.readFileSync(`test/fixtures/maven/${pickArtifact(url)}`)
    }

    function verifySuccess({ document, casedSpec }) {
      expect(document.hashes.sha1).to.be.equal(hashes['swt-3.3.0-v3346.jar']['sha1'])
      expect(document.hashes.sha256).to.be.equal(hashes['swt-3.3.0-v3346.jar']['sha256'])
      //date from manifest.mf modification date
      expect(document.releaseDate.startsWith('2007-06-25')).to.be.true
      expect(casedSpec.name).to.equal('swt')
      expect(casedSpec.namespace).to.equal('org.eclipse')
    }

    let handler

    beforeEach(() => {
      const requestPromiseStub = options => {
        const content = contentFromFile(options.url)
        return options.json ? JSON.parse(content) : content
      }
      const getStub = (url, callback) => {
        const response = new PassThrough()
        response.write(contentFromFile(url))
        callback(null, { statusCode: 200 })
        response.end()
        return response
      }
      handler = GradlePluginFetch({
        logger: { log: sinon.stub(), error: sinon.stub() },
        requestPromise: requestPromiseStub,
        requestStream: getStub
      })
    })

    it('build base url without namespace', () => {
      const url = handler._buildBaseUrl({
        type: 'maven',
        provider: 'gradleplugin',
        name: 'grpc-spring-boot-starter-gradle-plugin'
      })
      //should not fail
      expect(url).not.to.be.undefined
    })

    it('handle spec without namespace', async () => {
      const request = await handler.handle(new Request('test', 'cd:/maven/gradleplugin/-/swt/3.3.0-v3344'))
      expect(request.processControl).to.be.equal('skip')
    })

    it('test success with maven spec with version', async () => {
      const request = await handler.handle(new Request('test', 'cd:/maven/gradleplugin/org.eclipse/swt/3.3.0-v3344'))
      verifySuccess(request.fetchResult)
      expect(request.fetchResult.casedSpec.revision).to.equal('3.3.0-v3344')
      expect(request.fetchResult.document.location).to.be.a('string')
      expect(request.fetchResult.document.poms.length).to.equal(1)
    })

    it('test success with maven spec without version', async () => {
      const request = await handler.handle(new Request('test', 'cd:/maven/gradleplugin/org.eclipse/swt'))
      verifySuccess(request.fetchResult)
      expect(request.fetchResult.casedSpec.revision).to.equal('4.5.10')
      expect(request.fetchResult.url).to.equal('cd:/maven/gradleplugin/org.eclipse/swt/4.5.10')
    })

    it('test success with sourcearchive', async () => {
      const request = await handler.handle(new Request('test', 'cd:/sourcearchive/gradleplugin/org.eclipse/swt/3.3.0-v3344'))
      verifySuccess(request.fetchResult)
      expect(request.fetchResult.casedSpec.revision).to.equal('3.3.0-v3344')
      expect(request.fetchResult.document.location).to.be.a('string')
      expect(request.fetchResult.document.poms.length).to.equal(1)
    })

    it('handle no maven meta data found', async () => {
      handler._handleRequestPromise = sinon.stub().rejects({ statusCode: 404 })
      const request = await handler.handle(new Request('test', 'cd:/sourcearchive/gradleplugin/org.eclipse/swt'))
      expect(request.processControl).to.be.equal('skip')
    })

    it('handle no pom found', async () => {
      handler._handleRequestPromise = sinon.stub().rejects({ statusCode: 404 })
      const request = await handler.handle(new Request('test', 'cd:/sourcearchive/gradleplugin/org.eclipse/swt/3.3.0-v3344'))
      expect(request.processControl).to.be.equal('skip')
    })

    it('handle no sourcearchive found for plugin', async () => {
      handler._handleRequestStream = (url, callback) => {
        const response = new PassThrough()
        callback(new Error('404'), { statusCode: 404 })
        response.end()
        return response
      }
      const request = await handler.handle(new Request('test', 'cd:/sourcearchive/gradleplugin/org.eclipse/swt/3.3.0-v3344'))
      expect(request.processControl).to.be.equal('skip')
    })
  })
})