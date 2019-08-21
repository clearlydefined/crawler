// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const Request = require('ghcrawler').request
const composerExtract = require('../../../../providers/process/composerExtract')
const AbstractFetch = require('../../../../providers/fetch/abstractFetch')
const SourceSpec = require('../../../../lib/sourceSpec')

// SHA* hashes generated on Ubuntu using sha*sum
const hashes = {
  'symfony/polyfill-mbstring-1.11.0': {
    'symfony-polyfill-mbstring-fe5e94c/LICENSE': {
      sha1: '53a47cd3f3fee7cd8179a19d7741da412eed9de7',
      sha256: 'a718d662afdccd5db0c47543119dfa62b2d8b0dfd2d6d44a5e14397cb574e52b'
    },
    'symfony-polyfill-mbstring-fe5e94c/README.md': {
      sha1: 'c20aaad7bd777b2c7839c363a7a8dfd15f6cca63',
      sha256: '74a6cefb78dc6b1447f9686cc2a062112027c8d2a39c4da66fd43f0f2bf76c3f'
    },
    'symfony-polyfill-mbstring-fe5e94c/composer.json': {
      sha1: '9005581bb58110bc5525c70693f9d79d8fe76616',
      sha256: 'a81f24d2da5637b570ebb8999e48d6e145887c37109dd553d3c04f4e6d3980bf'
    }
  }
}

describe('PHP processing', () => {
  it('processes a simple php correctly', async () => {
    const { processor, request } = await setup()
    processor.linkAndQueue = sinon.stub()
    processor.sourceFinder = () => {
      return { type: 'git', provider: 'github', namespace: 'symfony', name: 'polyfill-mbstring', revision: '1.11.0' }
    }
    await processor.handle(request)
    const files = request.document.files

    expect(request.document).to.be.not.null
    files.forEach(file => {
      if (file.path.includes('LICENSE')) {
        expect(file.hashes.sha1).to.be.equal(hashes['symfony/polyfill-mbstring-1.11.0'][file.path].sha1)
        expect(file.hashes.sha256).to.be.equal(hashes['symfony/polyfill-mbstring-1.11.0'][file.path].sha256)
      } else if (file.path.includes('README')) {
        expect(file.hashes.sha1).to.be.equal(hashes['symfony/polyfill-mbstring-1.11.0'][file.path].sha1)
        expect(file.hashes.sha256).to.be.equal(hashes['symfony/polyfill-mbstring-1.11.0'][file.path].sha256)
      } else if (file.path.includes('composer.json')) {
        expect(file.hashes.sha1).to.be.equal(hashes['symfony/polyfill-mbstring-1.11.0'][file.path].sha1)
        expect(file.hashes.sha256).to.be.equal(hashes['symfony/polyfill-mbstring-1.11.0'][file.path].sha256)
      }
    })
    expect(processor.linkAndQueueTool.callCount).to.be.equal(3)
    expect(processor.linkAndQueueTool.args.map(call => call[1])).to.have.members(['licensee', 'scancode', 'fossology'])
    expect(request.document.attachments.length).to.eq(1)
    expect(request.document.summaryInfo.count).to.be.equal(8)
    expect(processor.linkAndQueue.callCount).to.be.equal(1)
    expect(processor.linkAndQueue.args[0][1]).to.equal('source')
    expect(processor.linkAndQueue.args[0][2].toUrl()).to.equal('cd:/git/github/symfony/polyfill-mbstring/1.11.0')
  })
})

async function setup() {
  const processor = composerExtract({ logger: { info: () => {} } }, () => {})
  processor._detectLicenses = () => 'MIT'
  processor.linkAndQueueTool = sinon.stub()
  const request = createRequest()
  const dir = processor.createTempDir(request)
  request.document.location = dir.name
  await new AbstractFetch({}).decompress(
    'test/fixtures/composer/symfony-polyfill-mbstring-v1.11.0-0-gfe5e94c.zip',
    dir.name
  )
  return { processor, request }
}

function createRequest() {
  const request = new Request('composer', 'cd:/composer/packagist/symfony/polyfill-mbstring/1.11.0')
  request.document = { _metadata: { links: {} }, registryData: { manifest: {} } }
  request.processMode = 'process'
  return request
}

describe('composerExtract source discovery', () => {
  it('discovers source candidates', async () => {
    const processor = composerExtract({ logger: { info: () => {} } }, () => {})
    const manifest = { source: { url: 'one' }, homepage: 'two', bugs: 'http://three' }
    const candidates = processor._discoverCandidateSourceLocations(manifest)
    expect(candidates).to.have.members(['one', 'two', 'http://three'])
  })

  it('discovers source candidates with odd structures', async () => {
    const processor = composerExtract({ logger: { info: () => {} } }, () => {})
    const manifest = { source: { url: 'one' }, homepage: ['two', 'three'], bugs: { url: 'four' } }
    const candidates = processor._discoverCandidateSourceLocations(manifest)
    expect(candidates.length).to.eq(3)
    expect(candidates).to.deep.equal(['one', ['two', 'three'], 'four'])
  })

  it('handles no tags in GitHub', async () => {
    const finder = sinon.stub().callsFake(() => null)
    const extractor = composerExtract({}, finder)
    const sourceLocation = await extractor._discoverSource({}, {})
    expect(sourceLocation).to.be.null
  })

  it('handles manifest urls in the right order', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = composerExtract({}, finder)
    const manifest = createManifest(null, 'http://url', 'http://bugs')
    const sourceLocation = await extractor._discoverSource(manifest, {})
    expect(sourceLocation.revision).to.eq(null)
    expect(sourceLocation.name).to.eq('bugs')
  })

  it('handles bugs object', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = composerExtract({}, finder)
    const manifest = createManifest(null, null, null, { url: 'http://bugs' })
    const sourceLocation = await extractor._discoverSource(manifest, {})
    expect(sourceLocation.revision).to.eq(null)
    expect(sourceLocation.name).to.eq('bugs')
  })

  it('handles bugs url', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = composerExtract({}, finder)
    const manifest = createManifest(null, null, null, 'http://bugs')
    const sourceLocation = await extractor._discoverSource(manifest, {})
    expect(sourceLocation.revision).to.eq(null)
    expect(sourceLocation.name).to.eq('bugs')
  })

  it('prioritizes manifest over registry', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = composerExtract({}, finder)
    const manifest = createManifest(null, null, null, 'http://bugs')
    const registry = createManifest('http://repo')
    const sourceLocation = await extractor._discoverSource(manifest, registry)
    expect(sourceLocation.revision).to.eq(null)
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
  return new SourceSpec('git', 'github', 'testorg', repo, revision)
}
