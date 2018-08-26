// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const extract = require('../../../../../providers/process/npmExtract')
const SourceSpec = require('../../../../../lib/sourceSpec')
const sinon = require('sinon')

describe('npmExtract source discovery', () => {
  it('handles no tags in GitHub', async () => {
    const finder = sinon.stub().callsFake(() => null)
    const extractor = extract({}, finder)
    const sourceLocation = await extractor._discoverSource({}, {})
    expect(sourceLocation).to.be.null
  })

  it('handles one tag in GitHub', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = extract({}, finder)
    const manifest = createManifest('http://repo')
    const sourceLocation = await extractor._discoverSource(manifest, {})
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('repo')
  })

  it('handles manifest urls in the right order', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = extract({}, finder)
    const manifest = createManifest(null, 'http://url', 'http://bugs')
    const sourceLocation = await extractor._discoverSource(manifest, {})
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('url')
  })

  it('handles bugs object', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = extract({}, finder)
    const manifest = createManifest(null, null, null, { url: 'http://bugs' })
    const sourceLocation = await extractor._discoverSource(manifest, {})
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('bugs')
  })

  it('handles bugs url', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = extract({}, finder)
    const manifest = createManifest(null, null, null, 'http://bugs')
    const sourceLocation = await extractor._discoverSource(manifest, {})
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('bugs')
  })

  it('prioritizes manifest over registry', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = extract({}, finder)
    const manifest = createManifest(null, null, null, 'http://bugs')
    const registry = createManifest('http://repo')
    const sourceLocation = await extractor._discoverSource(manifest, registry)
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('bugs')
  })
})

function sourceDiscovery() {
  return (version, candidates) => {
    return githubResults[candidates[0]]
  }
}

const githubResults = {
  'http://repo': createSourceSpec('repo'),
  'http://url': createSourceSpec('url'),
  'http://bugs': createSourceSpec('bugs')
}

function createManifest(repo, url, homepage, bugs) {
  return { repository: { url: repo }, url, homepage, bugs }
}

function createSourceSpec(repo, revision) {
  return new SourceSpec('git', 'github', 'testorg', repo, revision || '42')
}
