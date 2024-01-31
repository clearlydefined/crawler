// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const extract = require('../../../../providers/process/pypiExtract')
const SourceSpec = require('../../../../lib/sourceSpec')
const sinon = require('sinon')

describe('pypiExtract source discovery', () => {
  it('handles no tags in GitHub', async () => {
    const finder = sinon.stub().callsFake(() => null)
    const extractor = extract({}, finder)
    const sourceLocation = await extractor._discoverSource('13', {})
    expect(sourceLocation).to.be.null
  })

  it('handles one tag in GitHub', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = extract({}, finder)
    const manifest = createManifest('http://bug')
    const sourceLocation = await extractor._discoverSource('13', manifest)
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('bug')
  })

  it('handles manifest urls in the right order', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = extract({}, finder)
    const manifest = createManifest(null, 'http://download', 'http://package')
    const sourceLocation = await extractor._discoverSource('13', manifest)
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('download')
  })
})

function sourceDiscovery() {
  return (version, candidates) => {
    return githubResults[candidates[0]]
  }
}

const githubResults = {
  'http://bug': createSourceSpec('bug'),
  'http://doc': createSourceSpec('doc'),
  'http://download': createSourceSpec('download'),
  'http://home': createSourceSpec('home'),
  'http://package': createSourceSpec('package'),
  'http://project': createSourceSpec('project'),
  'http://release': createSourceSpec('release')
}

function createManifest(bugtrack_url, docs_url, download_url, home_page, package_url, project_url, release_url) {
  return { info: { bugtrack_url, docs_url, download_url, home_page, package_url, project_url, release_url } }
}

function createSourceSpec(repo, revision) {
  return new SourceSpec('git', 'github', 'testorg', repo, revision || '42')
}
