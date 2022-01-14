// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const fs = require('fs')
const sinon = require('sinon')
const GradlePluginFetch = require('../../../../providers/fetch/gradlePluginFetch')

describe('Gradle plugin fetch functions', () => {

  after(() => sinon.restore())

  it('spec without revision', async () => {
    const gradleFetch = GradlePluginFetch({
      logger: { log: sinon.stub() },
      requestPromise: sinon.stub().resolves(fs.readFileSync('test/fixtures/maven/maven-metadata.xml'))
    })
    const specWithRevision = await gradleFetch._processCoordinates({
      type: 'maven',
      provider: 'gradle-plugins',
      namespace: 'io.github.lognet',
      name: 'grpc-spring-boot-starter-gradle-plugin'
    })
    expect(specWithRevision.revision).to.be.eq('4.5.10')
  })

  it('spec with revision', async () => {
    const gradleFetch = GradlePluginFetch({})
    const specWithRevision = await gradleFetch._processCoordinates({
      type: 'maven',
      provider: 'gradle-plugins',
      namespace: 'io.github.lognet',
      name: 'grpc-spring-boot-starter-gradle-plugin',
      revision: '4.4'
    })
    expect(specWithRevision.revision).to.be.eq('4.4')
  })
})