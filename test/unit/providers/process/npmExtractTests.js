// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const Request = require('ghcrawler').request
const npmExtract = require('../../../../providers/process/npmExtract')
const AbstractFetch = require('../../../../providers/fetch/abstractFetch')

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
  it('computes the hashes correctly', async () => {
    const { processor, request } = await setup()
    await processor.handle(request)
    const files = request.document.files
    expect(request.document).to.be.not.null
    files.forEach(file => {
      expect(file.hashes.sha1).to.be.equal(hashes['redie-0.3.0'][file.path].sha1)
      expect(file.hashes.sha256).to.be.equal(hashes['redie-0.3.0'][file.path].sha256)
    })
  })
})

async function setup() {
  const request = new Request('npm', 'cd:/npm/npmjs/-/redie/0.3.0')
  const processor = npmExtract({ logger: {} }, () => {})
  processor._detectLicenses = () => 'MIT'
  processor.linkAndQueueTool = sinon.stub()
  const dir = processor.createTempDir(request)
  await new AbstractFetch({}).decompress('test/fixtures/npm/redie-0.3.0/redie-0.3.0.tgz', dir.name)
  request.document = { _metadata: { links: {} }, location: dir.name, registryData: { manifest: {} } }
  request.processMode = 'process'
  return { processor, request }
}
