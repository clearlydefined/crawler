// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const extract = require('../../../../../providers/process/mavenExtract')
const SourceSpec = require('../../../../../lib/sourceSpec')
const EntitySpec = require('../../../../../lib/entitySpec')
const sinon = require('sinon')
const mavenCentral = require('../../../../../lib/mavenCentral')

describe('mavenExtract source discovery', () => {
  it('handles no tags in GitHub', async () => {
    const spec = createSpec('test')
    const finder = sinon.stub().callsFake(() => null)
    const extractor = extract({}, finder)
    const sourceLocation = await extractor._discoverSource(spec, {}, {})
    expect(sourceLocation).to.be.null
  })

  it('handles one tag in GitHub', async () => {
    const spec = createSpec('test')
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = extract({}, finder)
    const manifest = createManifest('http://url')
    const sourceLocation = await extractor._discoverSource(spec, manifest, {})
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('url')
  })

  it('prioritizes github over maven central', async () => {
    const spec = createSpec('test')
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = extract({}, finder)
    const manifest = createManifest('http://url')
    const registry = createRegistryData()
    const sourceLocation = await extractor._discoverSource(spec, manifest, registry)
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('url')
  })

  it('falls back to maven central', async () => {
    const spec = createSpec('test')
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = extract({}, finder)
    const registry = createRegistryData()
    const sourceLocation = await extractor._discoverSource(spec, null, registry)
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.type).to.eq('sourcearchive')
    expect(sourceLocation.provider).to.eq('mavencentral')
    expect(sourceLocation.name).to.eq('test')
    expect(sourceLocation.namespace).to.eq('testorg')
  })
})

function sourceDiscovery() {
  return (version, candidates) => {
    return githubResults[candidates[0]]
  }
}

const githubResults = {
  'http://url': createSourceSpec('url')
}

function createManifest(url) {
  return { project: { scm: { url } } }
}

function createRegistryData() {
  return { ec: [mavenCentral.sourceExtension] }
}

function createSourceSpec(repo, revision) {
  return new SourceSpec('git', 'github', 'testorg', repo, revision || '42')
}

function createSpec(artifact, revision) {
  return new EntitySpec('maven', 'mavencentral', 'testorg', artifact, revision || '42')
}
