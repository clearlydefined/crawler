// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const DebianFetch = require('../../../../providers/fetch/debianFetch')
const memCache = require('memory-cache')
const Request = require('ghcrawler').request
const fs = require('fs')

const debianFetchOptions = { logger: { info: sinon.stub() }, cdFileLocation: 'test/fixtures/debian/fragment' }

describe('Debian utility functions', () => {
  it('gets data from package map file', async () => {
    const fetch = DebianFetch(debianFetchOptions)
    expect((await fetch._getDataFromPackageMapFile(spec('deb', 'debian', '0ad', '0.0.17-1_armhf'))).length).to.equal(9)
    expect((await fetch._getDataFromPackageMapFile(spec('debsrc', 'debian', '0ad', '0.0.17-1'))).length).to.equal(9)
    expect(
      (await fetch._getDataFromPackageMapFile(spec('deb', 'debian', '0ad', '0.0.23-1~bpo9+1_amd64'))).length
    ).to.equal(3)
    expect(
      (await fetch._getDataFromPackageMapFile(spec('debsrc', 'debian', '0ad', '0.0.23-1~bpo9+1'))).length
    ).to.equal(3)

    expect((await fetch._getDataFromPackageMapFile(spec('deb', 'debian', 'amiwm', '0.21pl2-1_amd64'))).length).to.equal(
      7
    )
    expect((await fetch._getDataFromPackageMapFile(spec('debsrc', 'debian', 'amiwm', '0.21pl2-1'))).length).to.equal(7)
    expect(
      (await fetch._getDataFromPackageMapFile(spec('deb', 'debian', 'non-existant', 'non-existant'))).length
    ).to.equal(0)
  })

  it('ensures architecture is present', async () => {
    const fetch = DebianFetch(debianFetchOptions)
    const binarySpecWithMissingArchitecture = spec('deb', 'debian', '0ad', '0.0.17-1')
    const registryData = await fetch._getDataFromPackageMapFile(binarySpecWithMissingArchitecture)
    expect(fetch._ensureArchitecturePresenceForBinary(binarySpecWithMissingArchitecture, registryData)).to.be.true
    expect(binarySpecWithMissingArchitecture.revision).to.equal('0.0.17-1_i386')
  })

  it('gets download URLs', async () => {
    const fetch = DebianFetch(debianFetchOptions)
    const spec1 = spec('deb', 'debian', '0ad', '0.0.17-1_armhf')
    const registryData1 = await fetch._getDataFromPackageMapFile(spec1)
    expect(fetch._getDownloadUrls(spec1, registryData1).binary).to.equal(
      'http://ftp.debian.org/debian/pool/main/0/0ad/0ad_0.0.17-1_armhf.deb'
    )
    const spec2 = spec('debsrc', 'debian', '0ad', '0.0.17-1')
    const registryData2 = await fetch._getDataFromPackageMapFile(spec1)
    expect(fetch._getDownloadUrls(spec2, registryData2).source).to.equal(
      'http://ftp.debian.org/debian/pool/main/0/0ad/0ad_0.0.17.orig.tar.xz'
    )
    expect(fetch._getDownloadUrls(spec2, registryData2).patches).to.equal(
      'http://ftp.debian.org/debian/pool/main/0/0ad/0ad_0.0.17-1.debian.tar.xz'
    )
  })
})

const hashes = {
  '0ad_0.0.17-1_armhf.deb': {
    sha1: '18dc18cb6397aa968408e554f3ff0e2010554b0d',
    sha256: '2906a834ca562152afbf2f25315727608c4b25566960cf9ee8b15e8110850fb8'
  }
}

describe('Debian fetching', () => {
  beforeEach(() => {
    memCache.put('packageFileMap', true)
  })

  afterEach(function() {
    memCache.del('packageFileMap')
  })

  it('can handle the request being attempted', async () => {
    expect(DebianFetch(debianFetchOptions).canHandle(new Request('test', 'cd:/deb/debian/-/0ad/0.0.17-1_armhf'))).to.be
      .true
  })

  it('succeeds in download, decompress and hash', async () => {
    const handler = DebianFetch(debianFetchOptions)
    handler._download = async (downloadUrl, destination) => {
      fs.copyFileSync('test/fixtures/debian/0ad_0.0.17-1_armhf.deb', destination)
    }
    const request = await handler.handle(new Request('test', 'cd:/deb/debian/-/0ad/0.0.17-1_armhf'))
    expect(request.document.hashes.sha1).to.be.equal(hashes['0ad_0.0.17-1_armhf.deb']['sha1'])
    expect(request.document.hashes.sha256).to.be.equal(hashes['0ad_0.0.17-1_armhf.deb']['sha256'])
    expect(request.document.releaseDate.getFullYear()).to.be.equal(2014)
  })
})

function spec(type, provider, name, revision) {
  const namespace = '-'
  return {
    type,
    provider,
    namespace,
    name,
    revision,
    toUrl: () => `cd:/${type}/${provider}/${namespace}/${name}/${revision}`
  }
}
