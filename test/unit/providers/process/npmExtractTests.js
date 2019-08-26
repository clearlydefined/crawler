// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const Request = require('ghcrawler').request
const npmExtract = require('../../../../providers/process/npmExtract')
const AbstractFetch = require('../../../../providers/fetch/abstractFetch')
const SourceSpec = require('../../../../lib/sourceSpec')

// SHA* hashes generated on Ubuntu using sha*sum
const hashes = {
  'redie-0.3.0': {
    'package/LICENSE': {
      sha1: '6401e7f1f46654117270c4860a263d3c4d6df1eb',
      sha256: '42c7def049b7ef692085ca9bdf5984d439d3291922e02cb112d5cd1287b3cc56'
    },
    'package/README.md': {
      sha1: 'f137a2544ac6b3589796fbd7dee87a35858f8d75',
      sha256: 'df3005370ff27872f241341dd11089951e099786a2b7e949262ab2ed5b3e4237'
    },
    'package/index.js': {
      sha1: '7561b32ffa21eeb8ca1c12a5e76ec28d718c3dfd',
      sha256: 'b83c7eeef19b2f4be9a8947db0bedc4ef43a15746e9c9b6f14e491f68bd2db60'
    },
    'package/package.json': {
      sha1: '74c5c9c1de88406c3d08272bfb6fe57055625fc9',
      sha256: '7bf06a09d2b1c79b2cad7820a97e3887749418e6c53da1f7fb7f1b7c430e386d'
    }
  }
}

describe('NPM processing', () => {
  it('processes a simple npm correctly', async () => {
    const { processor, request } = await setup()
    processor.linkAndQueue = sinon.stub()
    processor.sourceFinder = () => {
      return { type: 'git', provider: 'github', namespace: 'Microsoft', name: 'redie', revision: '42' }
    }
    await processor.handle(request)
    const files = request.document.files
    expect(request.document).to.be.not.null
    files.forEach(file => {
      expect(file.hashes.sha1).to.be.equal(hashes['redie-0.3.0'][file.path].sha1)
      expect(file.hashes.sha256).to.be.equal(hashes['redie-0.3.0'][file.path].sha256)
    })
    expect(processor.linkAndQueueTool.callCount).to.be.equal(2)
    expect(processor.linkAndQueueTool.args.map(call => call[1])).to.have.members([
      'licensee',
      'scancode' /*, 'fossology'*/
    ])
    expect(request.document.attachments.length).to.eq(2)
    expect(request.document._attachments.length).to.eq(2)
    expect(request.document.summaryInfo.count).to.be.equal(4)
    expect(processor.linkAndQueue.callCount).to.be.equal(1)
    expect(processor.linkAndQueue.args[0][1]).to.equal('source')
    expect(processor.linkAndQueue.args[0][2].toUrl()).to.equal('cd:/git/github/Microsoft/redie/42')
  })
})

async function setup() {
  const processor = npmExtract({ logger: {} }, () => {})
  processor._detectLicenses = () => 'MIT'
  processor.linkAndQueueTool = sinon.stub()
  const request = createRequest()
  const dir = processor.createTempDir(request)
  request.document.location = dir.name
  await new AbstractFetch({}).decompress('test/fixtures/npm/redie-0.3.0.tgz', dir.name)
  return { processor, request }
}

function createRequest() {
  const request = new Request('npm', 'cd:/npm/npmjs/-/redie/0.3.0')
  request.document = { _metadata: { links: {} }, registryData: { manifest: {} } }
  request.processMode = 'process'
  return request
}

describe('npmExtract source discovery', () => {
  it('discovers source candidates', async () => {
    const processor = npmExtract({ logger: { info: () => {} } }, () => {})
    const manifest = { repository: { url: 'one' }, url: 'two', homepage: 'three', bugs: 'http://four' }
    const candidates = processor._discoverCandidateSourceLocations(manifest)
    expect(candidates).to.have.members(['one', 'two', 'three', 'http://four'])
  })

  it('discovers source candidates with odd structures', async () => {
    const processor = npmExtract({ logger: { info: () => {} } }, () => {})
    const manifest = { repository: { url: 'one' }, url: 'two', homepage: ['three', 'four'], bugs: { url: 'five' } }
    const candidates = processor._discoverCandidateSourceLocations(manifest)
    expect(candidates).to.have.members(['one', 'two', 'three', 'five'])
  })

  it('handles no tags in GitHub', async () => {
    const finder = sinon.stub().callsFake(() => null)
    const extractor = npmExtract({}, finder)
    const sourceLocation = await extractor._discoverSource({}, {})
    expect(sourceLocation).to.be.null
  })

  it('handles one tag in GitHub', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = npmExtract({}, finder)
    const manifest = createManifest('http://repo')
    const sourceLocation = await extractor._discoverSource(manifest, {})
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('repo')
  })

  it('handles manifest urls in the right order', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = npmExtract({}, finder)
    const manifest = createManifest(null, 'http://url', 'http://bugs')
    const sourceLocation = await extractor._discoverSource(manifest, {})
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('url')
  })

  it('handles bugs object', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = npmExtract({}, finder)
    const manifest = createManifest(null, null, null, { url: 'http://bugs' })
    const sourceLocation = await extractor._discoverSource(manifest, {})
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('bugs')
  })

  it('handles bugs url', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = npmExtract({}, finder)
    const manifest = createManifest(null, null, null, 'http://bugs')
    const sourceLocation = await extractor._discoverSource(manifest, {})
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('bugs')
  })

  it('prioritizes manifest over registry', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = npmExtract({}, finder)
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
