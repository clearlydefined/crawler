// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const extract = require('../../../../providers/process/nugetExtract')
const SourceSpec = require('../../../../lib/sourceSpec')
const sinon = require('sinon')

describe('nugetExtract source discovery', () => {
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
    const manifest = createManifest(null, 'http://project', 'http://license')
    const sourceLocation = await extractor._discoverSource(manifest, {})
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('project')
  })

  it('prioritizes manifest over nuspec', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = extract({}, finder)
    const manifest = createManifest(null, null, 'http://license')
    const registry = createNuspec('http://repo')
    const sourceLocation = await extractor._discoverSource(manifest, registry)
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('license')
  })
})

function sourceDiscovery() {
  return (version, candidates) => {
    return githubResults[candidates[0]]
  }
}

const githubResults = {
  'http://repo': createSourceSpec('repo'),
  'http://project': createSourceSpec('project'),
  'http://license': createSourceSpec('license')
}

function createManifest(repo, projectUrl, licenseUrl) {
  return { repository: { url: repo }, projectUrl, licenseUrl }
}

function createNuspec(repo, projectUrl, licenseUrl) {
  return { package: { metadata: createManifest(repo, projectUrl, licenseUrl) } }
}

function createSourceSpec(repo, revision) {
  return new SourceSpec('git', 'github', 'testorg', repo, revision || '42')
}
