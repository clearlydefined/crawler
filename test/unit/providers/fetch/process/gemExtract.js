// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const extract = require('../../../../../providers/process/gemExtract')
const SourceSpec = require('../../../../../lib/sourceSpec')
const sinon = require('sinon')

describe('gemExtract source discovery', () => {
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
    const manifest = createManifest(null, 'http://change', 'http://doc')
    const sourceLocation = await extractor._discoverSource('13', manifest)
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('change')
  })
})

function sourceDiscovery() {
  return (version, candidates) => {
    return githubResults[candidates[0]]
  }
}

const githubResults = {
  'http://bug': createSourceSpec('bug'),
  'http://change': createSourceSpec('change'),
  'http://doc': createSourceSpec('doc'),
  'http://gem': createSourceSpec('gem'),
  'http://home': createSourceSpec('home'),
  'http://mail': createSourceSpec('mail'),
  'http://source': createSourceSpec('source')
}

function createManifest(
  bug_tracker_uri,
  changelog_uri,
  documentation_uri,
  gem_uri,
  homepage_uri,
  mailing_list_uri,
  source_code_uri
) {
  return { bug_tracker_uri, changelog_uri, documentation_uri, gem_uri, homepage_uri, mailing_list_uri, source_code_uri }
}

function createSourceSpec(repo, revision) {
  return new SourceSpec('git', 'github', 'testorg', repo, revision || '42')
}
