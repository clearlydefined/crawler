// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const Request = require('../../../../ghcrawler').request
const CrateExtract = require('../../../../providers/process/crateExtract')
const AbstractFetch = require('../../../../providers/fetch/abstractFetch')

// SHA* hashes generated on Ubuntu using sha*sum
const hashes = {
  'bitflags-1.0.4': {
    '.gitignore': {
      sha1: '3254b5d5538166f1fd5a0bb41f7f3d3bbd455c56',
      sha256: 'f9b1ca6ae27d1c18215265024629a8960c31379f206d9ed20f64e0b2dcf79805'
    },
    'CHANGELOG.md': {
      sha1: '87b1447fcb5155a5ba3bc476c6b870799bed78c7',
      sha256: 'b9f503da2d3c91b0a244f1dc853d975f971f782b209ea52cd4cd98705e6e2749'
    },
    'CODE_OF_CONDUCT.md': {
      sha1: '82ce99058d5f84f3c3c2f548e7674de67d786e83',
      sha256: '42634d0f6d922f49857175af991802822f7f920487aefa2ee250a50d12251a66'
    },
    'Cargo.toml': {
      sha1: '116f829c6f5099f58b7c7ef6d11655e93d35e34f',
      sha256: '0234b6f827764ca093d897126b45505be0996e67860d61caeab696d092ffb781'
    },
    'Cargo.toml.orig': {
      sha1: '810c9f23ba089372b992496166cdec13733959fc',
      sha256: 'b2512e34fec0b32dabd8a2d4339ed22c9d1a3697f525f25500020bbd6f020456'
    },
    'LICENSE-APACHE': {
      sha1: '5798832c31663cedc1618d18544d445da0295229',
      sha256: 'a60eea817514531668d7e00765731449fe14d059d3249e0bc93b36de45f759f2'
    },
    'LICENSE-MIT': {
      sha1: '9f3c36d2b7d381d9cf382a00166f3fbd06783636',
      sha256: '6485b8ed310d3f0340bf1ad1f47645069ce4069dcc6bb46c7d5c6faf41de1fdb'
    },
    'README.md': {
      sha1: 'efd05ffa19723f822a85c5b76bda239be1d1aee1',
      sha256: '6b236f8b62c82f189fabce0756e01a2c0ab1f32cb84cad9ff3c96b2ce5282bda'
    },
    'src/example_generated.rs': {
      sha1: '6f1ac32232c5519998c87432f356c0090ef09b76',
      sha256: 'e43eb59e90f317f38d436670a6067d2fd9eb35fb319fe716184e4a04e24ed1b2'
    },
    'src/lib.rs': {
      sha1: '731ff4783523618c1e98b064d716fa5768dbac54',
      sha256: '5751eb6fbb8cb97d8accd0846493168d9b5acff1f8d64435d4da8ad7dbf36b4d'
    }
  }
}

describe('Crate processing', () => {
  it('processes a simple crate correctly', async () => {
    const { processor, request } = await setup()
    processor.linkAndQueue = sinon.stub()
    processor.sourceFinder = () => {
      return { type: 'git', provider: 'github', namespace: 'bitflags', name: 'bitflags', revision: '42' }
    }
    await processor.handle(request)
    const files = request.document.files
    expect(request.document).to.be.not.null
    files.forEach(file => {
      expect(file.hashes.sha1).to.be.equal(hashes['bitflags-1.0.4'][file.path].sha1)
      expect(file.hashes.sha256).to.be.equal(hashes['bitflags-1.0.4'][file.path].sha256)
    })
    expect(processor.linkAndQueueTool.callCount).to.be.equal(3)
    expect(processor.linkAndQueueTool.args.map(call => call[1])).to.have.members([
      'licensee',
      'scancode',
      'reuse' /*, 'fossology'*/
    ])
    expect(request.document.summaryInfo.count).to.be.equal(10)
    expect(processor.linkAndQueue.callCount).to.be.equal(1)
    expect(processor.linkAndQueue.args[0][1]).to.equal('source')
    expect(processor.linkAndQueue.args[0][2].toUrl()).to.equal('cd:/git/github/bitflags/bitflags/42')
  })
})

async function setup() {
  const processor = CrateExtract({ logger: {} }, () => { })
  processor._detectLicenses = () => 'MIT'
  processor.linkAndQueueTool = sinon.stub()
  const request = createRequest()
  const dir = processor.createTempDir(request)
  request.document.location = `${dir.name}/bitflags-1.0.4`
  await new AbstractFetch({}).decompress('test/fixtures/crates/bitflags-1.0.4.crate', dir.name)
  return { processor, request }
}

function createRequest() {
  const request = new Request('npm', 'cd:/crate/cratesio/-/bitflags/1.0.4')
  request.document = {
    _metadata: { links: {} },
    registryData: { crate: 'bitflags', num: '1.0.4' },
    manifest: {
      homepage: 'https://github.com/bitflags/bitflags',
      documentation: 'https://docs.rs/bitflags',
      repository: 'https://github.com/bitflags/bitflags'
    }
  }
  request.processMode = 'process'
  return request
}

describe('crateExtract', () => {
  it('handles only crates', () => {
    const crateExtract = CrateExtract({})
    expect(crateExtract.canHandle({ type: 'crate', url: 'cd:/crate/cratesio/-/name/0.1.0' })).to.be.true
    expect(crateExtract.canHandle({ type: 'npm', url: 'cd:/npm/npmjs/-/name/0.1.0' })).to.be.false
  })
})
