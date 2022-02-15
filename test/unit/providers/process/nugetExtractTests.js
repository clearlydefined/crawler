// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const SourceSpec = require('../../../../lib/sourceSpec')
const Request = require('../../../../ghcrawler').request
const extract = require('../../../../providers/process/nugetExtract')
const AbstractFetch = require('../../../../providers/fetch/abstractFetch')

// SHA* hashes generated on Ubuntu using sha*sum
const hashes = {
  'xunit.core.2.4.1': {
    '.signature.p7s': {
      sha1: 'cfdbf40dc9729d51621609c440b0aab6e82ca62c',
      sha256: '83a8224a271c8340855d80baa7169604a0d60c914e3a852b6423b3c54124e2e7'
    },
    '[Content_Types].xml': {
      sha1: '5e7b5e8e973dfb200d56e6894978cf4652c431dc',
      sha256: 'b5a90ff27fec02ae69707b8a1bbe2bd069b47519daeface707303722fbf6e01e'
    },
    'xunit.core.nuspec': {
      sha1: 'c05dad55561e3c2df400b8b13c944590b15ee98c',
      sha256: '2c411d7ef591767dfc42910d6cad592d77a3ce4c4d4333b8477c1465e936af10'
    },
    '_rels/.rels': {
      sha1: 'b5515c2da3422faba0848fe256a5b6ec4afca732',
      sha256: '0c3ee1caf5de49929c8be1050b5d13e7e97130f008749a0a4c38da292cfe049e'
    },
    'build/xunit.core.props': {
      sha1: '9cce282dd8f38294df68a8945988572b07f7298b',
      sha256: '91d72e308289a3b92f4ea16357f3d893c6552e5af256838cb5372b45f2ad2856'
    },
    'build/xunit.core.targets': {
      sha1: '04727e3c2a540f437c37d20e4e6cb872618c7e81',
      sha256: '5ee8e74529a707ebf9c86904a38d4d0aaadea70e991b0c61697246fa7adbb71d'
    },
    'buildMultiTargeting/xunit.core.props': {
      sha1: '9cce282dd8f38294df68a8945988572b07f7298b',
      sha256: '91d72e308289a3b92f4ea16357f3d893c6552e5af256838cb5372b45f2ad2856'
    },
    'buildMultiTargeting/xunit.core.targets': {
      sha1: '04727e3c2a540f437c37d20e4e6cb872618c7e81',
      sha256: '5ee8e74529a707ebf9c86904a38d4d0aaadea70e991b0c61697246fa7adbb71d'
    },
    'package/services/metadata/core-properties/929de7b81e6f4062812c1a95465898c7.psmdcp': {
      sha1: '2cc94ae30faf15ea01ddd2aa49fbf581a7005b2a',
      sha256: 'd4a95f4d4c7f23c17942fecac5cac2bb9dd8a41dfc9fcb57adbf20ab1b64841f'
    }
  }
}

describe('NuGet processing', () => {
  it('processes a simple nuget correctly', async () => {
    const { processor, request } = await setup()
    processor.linkAndQueue = sinon.stub()
    processor.sourceFinder = () => {
      return { type: 'git', provider: 'github', namespace: 'Microsoft', name: 'xunit', revision: '42' }
    }
    await processor.handle(request)
    const files = request.document.files
    expect(request.document).to.be.not.null
    files.forEach(file => {
      expect(file.hashes.sha1).to.be.equal(hashes['xunit.core.2.4.1'][file.path].sha1)
      expect(file.hashes.sha256).to.be.equal(hashes['xunit.core.2.4.1'][file.path].sha256)
    })
    expect(processor.linkAndQueueTool.callCount).to.be.equal(3)
    expect(processor.linkAndQueueTool.args.map(call => call[1])).to.have.members(['licensee', 'scancode', 'reuse'])
    expect(request.document.summaryInfo.count).to.be.equal(9)
    expect(processor.linkAndQueue.callCount).to.be.equal(1)
    expect(processor.linkAndQueue.args[0][1]).to.equal('source')
    expect(processor.linkAndQueue.args[0][2].toUrl()).to.equal('cd:/git/github/Microsoft/xunit/42')
  })
})

async function setup() {
  const processor = extract({ logger: {} }, () => { })
  processor.linkAndQueueTool = sinon.stub()
  const request = createRequest()
  const dir = processor.createTempDir(request)
  request.document.metadataLocation = {
    manifest: 'test/fixtures/nuget/xunit.core.2.4.1.catalog.json',
    nuspec: 'test/fixtures/nuget/xunit.core.2.4.1.nuspec'
  }
  request.document.location = `${dir.name}/nupkg`
  await new AbstractFetch({}).decompress('test/fixtures/nuget/xunit.core.2.4.1.nupkg', `${dir.name}/nupkg`)
  return { processor, request }
}

function createRequest() {
  const request = new Request('nuget', 'cd:/nuget/nuget/-/xunit.core/2.4.1')
  request.document = { _metadata: { links: {} }, registryData: { manifest: {} } }
  request.processMode = 'process'
  return request
}

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

  it('prioritizes nuspec over manifest', async () => {
    const finder = sinon.stub().callsFake(sourceDiscovery())
    const extractor = extract({}, finder)
    const manifest = createManifest(null, null, 'http://license')
    const registry = createNuspec('http://repo')
    const sourceLocation = await extractor._discoverSource(manifest, registry)
    expect(sourceLocation.revision).to.eq('42')
    expect(sourceLocation.name).to.eq('repo')
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
