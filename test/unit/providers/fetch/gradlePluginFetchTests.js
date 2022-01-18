// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const fs = require('fs')
const sinon = require('sinon')
const GradlePluginFetch = require('../../../../providers/fetch/gradlePluginFetch')

describe('Gradle plugin fetch functions', () => {

  after(() => sinon.restore())

  it('get latest version from maven meta data', async () => {
    const gradleFetch = GradlePluginFetch({
      logger: { log: sinon.stub() },
      requestPromise: sinon.stub().resolves(fs.readFileSync('test/fixtures/maven/maven-metadata.xml'))
    })
    const latest = await gradleFetch._getLatestVersion({
      type: 'maven',
      provider: 'gradleplugin',
      namespace: 'io.github.lognet',
      name: 'grpc-spring-boot-starter-gradle-plugin'
    })
    expect(latest).to.be.eq('4.5.10')
  })

  it('no latest version', async () => {
    const gradleFetch = GradlePluginFetch({
      logger: { log: sinon.stub() },
      requestPromise: sinon.stub().resolves('')
    })
    const latest = await gradleFetch._getLatestVersion({
      type: 'maven',
      provider: 'gradleplugin',
      namespace: 'io.github.lognet',
      name: 'grpc-spring-boot-starter-gradle-plugin'
    })
    expect(latest).to.be.undefined
  })

  it('build base url if namespace is not provided', async () => {
    const gradleFetch = GradlePluginFetch({})
    const url = gradleFetch._buildBaseUrl({
      type: 'maven',
      provider: 'gradleplugin',
      name: 'grpc-spring-boot-starter-gradle-plugin'
    })
    expect(url).not.to.be.undefined
  })
})