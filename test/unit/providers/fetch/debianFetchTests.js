// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const DebianFetch = require('../../../../providers/fetch/debianFetch')
const memCache = require('memory-cache')
const Request = require('../../../../ghcrawler').request
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

  it('gets copyright URL', async () => {
    const fetch = DebianFetch(debianFetchOptions)
    const expectedCopyrightUrl = 'https://metadata.ftp-master.debian.org/changelogs/main/0/0ad/0ad_0.0.17-1_copyright'
    const spec1 = spec('deb', 'debian', '0ad', '0.0.17-1_armhf')
    const registryData1 = await fetch._getDataFromPackageMapFile(spec1)
    expect(fetch._getCopyrightUrl(registryData1)).to.equal(expectedCopyrightUrl)
    const spec2 = spec('debsrc', 'debian', '0ad', '0.0.17-1')
    const registryData2 = await fetch._getDataFromPackageMapFile(spec2)
    expect(fetch._getCopyrightUrl(registryData2)).to.equal(expectedCopyrightUrl)
  })

  it('parses declared licenses', () => {
    const fetch = DebianFetch(debianFetchOptions)
    const copyrightResponse = fs.readFileSync('test/fixtures/debian/0ad_0.0.17-1_copyright.txt').toString()
    expect(fetch._parseDeclaredLicenses(copyrightResponse)).to.deep.equal([
      'GPL-2.0+',
      'MIT',
      'CPL-1.0',
      'BSD-3-clause',
      'GPL-3.0',
      'LGPL-2.1+',
      'public-domain',
      'MPL-1.1',
      'GPL-2.0',
      'LGPL-2.1'
    ])
    // Edge cases:
    expect(fetch._parseDeclaredLicenses('License: GPL-1+ or Artistic')).to.deep.equal(['(GPL-1+ OR Artistic)'])
    expect(fetch._parseDeclaredLicenses('License: GPL-2+ and BSD-3-clause')).to.deep.equal(['GPL-2+', 'BSD-3-clause'])
    expect(fetch._parseDeclaredLicenses('License: GPL-2+ or Artistic-2.0, and BSD-3-clause')).to.deep.equal([
      '(GPL-2+ OR Artistic-2.0)',
      'BSD-3-clause'
    ])
    expect(fetch._parseDeclaredLicenses('License: Expat or Artistic and Artistic-2.0')).to.deep.equal([
      '(MIT OR Artistic AND Artistic-2.0)'
    ])
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

  afterEach(() => {
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
    handler._getDeclaredLicenses = async () => {
      return ['MIT', 'BSD-3-clause']
    }
    const request = await handler.handle(new Request('test', 'cd:/deb/debian/-/0ad/0.0.17-1_armhf'))
    request.fetchResult.copyTo(request)
    expect(request.document.hashes.sha1).to.be.equal(hashes['0ad_0.0.17-1_armhf.deb']['sha1'])
    expect(request.document.hashes.sha256).to.be.equal(hashes['0ad_0.0.17-1_armhf.deb']['sha256'])
    expect(request.document.releaseDate.getFullYear()).to.be.equal(2014)
    expect(request.document.copyrightUrl).to.be.equal(
      'https://metadata.ftp-master.debian.org/changelogs/main/0/0ad/0ad_0.0.17-1_copyright'
    )
    expect(request.document.declaredLicenses).to.deep.equal(['MIT', 'BSD-3-clause'])
  })

  it('failed to get declared license', async () => {
    const handler = DebianFetch(debianFetchOptions)
    handler._download = async (downloadUrl, destination) => {
      fs.copyFileSync('test/fixtures/debian/0ad_0.0.17-1_armhf.deb', destination)
    }
    handler._getDeclaredLicenses = sinon.stub().rejects('failed')
    const request = new Request('test', 'cd:/deb/debian/-/0ad/0.0.17-1_armhf')
    try {
      await handler.handle(request)
      expect(false).to.be.true
    } catch (error) {
      expect(request.getTrackedCleanups().length).to.be.equal(2)
    }
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
