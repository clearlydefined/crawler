// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const { RpmRepo, RpmFetch } = require('../../../../providers/fetch/rpmFetch')
const memCache = require('memory-cache')
const Request = require('../../../../ghcrawler').request
const fs = require('fs')

const cdFileLocation = 'test/fixtures/rpm/repodata'

const repos = [new RpmRepo(
  {
    baseUrl: "https://packages.microsoft.com/cbl-mariner/2.0/prod/base/x86_64/",
    cdFileLocation: cdFileLocation + "/mariner-base-2.0"
  }), new RpmRepo(
    {
      baseUrl: "https://packages.microsoft.com/cbl-mariner/2.0/prod/base/srpms/",
      cdFileLocation: cdFileLocation + "/mariner-base-2.0-sources"
    })]
const options = { logger: { info: sinon.stub() }, cdFileLocation: cdFileLocation }


describe('RPM utility functions', () => {
  it('gets data from repo db', async () => {
    const handler = new RpmFetch(repos, options)
    // Package and version exist
    var bar = await handler._getRegistryData(spec('rpm', 'mariner', 'clang-devel', '12.0.1-3.cm2.x86_64'), false)
    expect(await handler._getRegistryData(spec('rpm', 'mariner', 'clang-devel', '12.0.1-3.cm2.x86_64'), false)).to.not.be.null
    // Package exists but version doesn't
    const foo = await handler._getRegistryData(spec('rpm', 'mariner', 'clang-devel', '12.0.0-3.cm2.x86_64'), false)
    expect(await handler._getRegistryData(spec('rpm', 'mariner', 'clang-devel', '12.0.0-3.cm2.x86_64'), false)).to.be.null
    // Package doesn't exist
    expect(await handler._getRegistryData(spec('rpm', 'mariner', 'non-existant', 'non-existant'), false)).to.be.null
  })

  it('gets latest version data from repo db', async () => {
    const handler = new RpmFetch(repos, options)
    const latest_glibc = await handler._getLatestVersion("glibc", false)
    expect(latest_glibc.release).to.be.equal("2.cm2")
  })

  it('gets package', async () => {
    const handler = new RpmFetch(repos, options)
    const request = new Request('test', 'cd:/rpm/mariner/-/tini/0.19.0-7.cm2.x86_64')
    var spec1 = spec('rpm', 'mariner', 'tini', '0.19.0-7.cm2.x86_64')
    var registryData = await handler._getRegistryData(spec1, false)
    expect(registryData).to.not.be.null
    var { dir } = await handler._getPackage(request, registryData)
    expect(await handler._getSrcRpmUrl(registryData)).to.be.equal("https://packages.microsoft.com/cbl-mariner/2.0/prod/base/srpms/tini-0.19.0-7.cm2.src.rpm")
  })

  it('retrieves licenses', async () => {
    const handler = new RpmFetch(repos, options)
    // sharutils has a the license "GPLv3+ AND (GPLv3+ AND BSD) AND (LGPLv3+ OR BSD) AND LGPLv2+ AND Public Domain AND GFDL"
    // check that we update the various BSD/GPL entries with SPDX identifiers
    var spec1 = spec('rpm', 'mariner', 'sharutils', '4.15.2-19.cm2.x86_64')
    var registryData = await handler._getRegistryData(spec1, false)
    expect(await handler._getDeclaredLicense(registryData)).to.equal("GPL-3.0-or-later AND (GPL-3.0-or-later AND BSD-3-Clause) AND (LGPL-3.0-or-later OR BSD-3-Clause) AND LGPL-2.0-or-later AND Public Domain AND GFDL")
  })

  it('retrieves repository metadata', async () => {
    const handler = new RpmFetch(repos, options)
    handler._getRegistryData()
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
