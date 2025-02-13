// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const extract = require('../../../../providers/process/mavenExtract')
const SourceSpec = require('../../../../lib/sourceSpec')
const EntitySpec = require('../../../../lib/entitySpec')

describe('mavenExtract source discovery', () => {
  it('verifies the version of the nuget extract', () => {
    const extractor = extract({}, () => {})
    expect(extractor._schemaVersion).to.equal('1.5.1')
  })

  it('handles no tags in GitHub and falls back to made up sourcearchive', async () => {
    const spec = createSpec('test')
    const extractor = extract({}, () => null)
    const sourceLocation = await extractor._discoverSource(spec, {}, {})
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.type).to.eq('sourcearchive')
    expect(sourceLocation.provider).to.eq('mavencentral')
    expect(sourceLocation.name).to.eq('test')
    expect(sourceLocation.namespace).to.eq('testorg')
  })

  it('handles one tag in GitHub', async () => {
    const spec = createSpec('test')
    const extractor = extract({}, sourceDiscovery())
    const manifest = createManifest('http://url')
    const sourceLocation = await extractor._discoverSource(spec, manifest, {})
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('url')
  })

  it('prioritizes github over maven central', async () => {
    const spec = createSpec('test')
    const extractor = extract({}, sourceDiscovery())
    const manifest = createManifest('http://url')
    const sourceLocation = await extractor._discoverSource(spec, manifest)
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('url')
  })

  it('handles maven google', async () => {
    const spec = new EntitySpec('maven', 'mavengoogle', 'testorg', 'test', '42')
    const extractor = extract({}, () => {})
    const sourceLocation = await extractor._discoverSource(spec)
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.type).to.eq('sourcearchive')
    expect(sourceLocation.provider).to.eq('mavengoogle')
    expect(sourceLocation.name).to.eq('test')
    expect(sourceLocation.namespace).to.eq('testorg')
  })

  it('falls back to maven central', async () => {
    const spec = createSpec('test')
    const extractor = extract({}, () => {})
    const sourceLocation = await extractor._discoverSource(spec)
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
  return { summary: { scm: [{ url: [url] }] } }
}

function createSourceSpec(repo, revision) {
  return new SourceSpec('git', 'github', 'testorg', repo, revision || '42')
}

function createSpec(artifact, revision) {
  return new EntitySpec('maven', 'mavencentral', 'testorg', artifact, revision || '42')
}
