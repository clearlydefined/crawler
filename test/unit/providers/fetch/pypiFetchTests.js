// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const fs = require('fs')
const sinon = require('sinon')
const PassThrough = require('stream').PassThrough
const nodeFetch = require('../../../../lib/fetch')
const PypiFetch = require('../../../../providers/fetch/pypiFetch')
const requestRetryWithDefaults = require('../../../../providers/fetch/requestRetryWithDefaults')
const Request = require('../../../../ghcrawler/lib/request.js')
const pypiFetchOptions = { logger: { info: sinon.stub() } }
const spdxCorrect = require('spdx-correct')

describe('pypiFetch handle function', () => {
  let sandbox = sinon.createSandbox()
  let requestGetStub
  let fetch
  let nodeRequestStub

  beforeEach(function () {
    let nodeFetchStub = sandbox.stub(nodeFetch)
    requestGetStub = nodeFetchStub.callFetchWithRetry
    nodeRequestStub = nodeFetchStub.getStream
    fetch = PypiFetch(pypiFetchOptions)
  })

  afterEach(function () {
    sandbox.restore()
  })

  it('returns missing when registry data is not found', async () => {
    // Setup the stub to return an empty response (e.g. no body)
    requestGetStub.returns({})

    let result = await fetch.handle(new Request('pypi', 'cd:/pypi/pypi/-/reuse/0.8.1'))

    expect(result.outcome).to.be.equal('Missing  ')
  })

  it('fetch success', async () => {
    const registryData = JSON.parse(fs.readFileSync('test/fixtures/pypi/registryData.json'))
    requestGetStub.resolves({ body: registryData, statusCode: 200 })
    nodeRequestStub.resolves(getCompressedFile())
    const result = await fetch.handle(new Request('pypi', 'cd:/pypi/pypi/-/backports.ssl-match-hostname/3.7.0.1'))
    result.fetchResult.copyTo(result)
    expect(result.url).to.be.equal('cd:/pypi/pypi/-/backports.ssl-match-hostname/3.7.0.1')
    expect(result.contentOrigin).to.be.equal('origin')
    expect(result.casedSpec.toUrl()).to.be.equal('cd:/pypi/pypi/-/backports.ssl_match_hostname/3.7.0.1')
    expect(result.document.location).to.be.a.string
    expect(result.document.registryData).to.be.deep.equal(registryData)
    expect(result.document.releaseDate).to.be.equal('2019-01-12T22:25:58')
    expect(result.document.hashes).to.be.deep.equal({
      sha1: 'd886a6db6b7195911516896feebe3a5d1dddfd46',
      sha256: '18a3a53a27df164d4db56d0f7f5da2edd25995418d5538f40eb4018347fe1354'
    })
  })

  it('returns missing when failed to find download url', async () => {
    // release information in the registry data is empty
    requestGetStub.returns({
      body: {
        releases: { '1.10.0': [] }
      },
      statusCode: 200
    })

    let result = await fetch.handle(new Request('pypi', 'cd:/pypi/pypi/-/dnspython/1.10.0'))
    expect(result.outcome).to.be.equal('Missing  ')
  })

  describe('extractDeclaredLicense', () => {
    it('parses LGPL-2.1-only: info.license over classifiers (crawler/issues/523)', () => {
      const registryData = JSON.parse(fs.readFileSync('test/fixtures/pypi/registryData_lgpl2.json'))
      const declared = fetch._extractDeclaredLicense(registryData)
      expect(declared).to.be.equal('LGPL-2.1-only')
    })

    it('parses the correct license information from info.license in registry data', () => {
      const registryData = JSON.parse(fs.readFileSync('test/fixtures/pypi/registryData_dnspython.json'))
      const declared = fetch._extractDeclaredLicense(registryData)
      expect(declared).to.be.equal('ISC')
    })

    it('parses BSD-3-Clause for UpSetPlot/0.9.0: info.license over classifiers (crawler/issues/523)', () => {
      const registryData = JSON.parse(fs.readFileSync('test/fixtures/pypi/registryData-info_bsd3.json'))
      const declared = fetch._extractDeclaredLicense(registryData)
      expect(declared).to.be.equal('BSD-3-Clause')
    })

    it('parses GPL-2.0-or-later for pylint/3.2.3: info.license over classifiers (curated-data/pull/27902#issuecomment-2191907126)', () => {
      const registryData = JSON.parse(fs.readFileSync('test/fixtures/pypi/registryData-info_gpl2+.json'))
      const declared = fetch._extractDeclaredLicense(registryData)
      expect(declared).to.be.equal('GPL-2.0-or-later')
    })

    it('parses HPND for pillow/8.3.0: info.license over classifiers (crawler/issues/519, crawler/issues/429)', () => {
      const registryData = JSON.parse(fs.readFileSync('test/fixtures/pypi/registryData-info_hpnd.json'))
      const declared = fetch._extractDeclaredLicense(registryData)
      expect(declared).to.be.equal('HPND')
    })

    it('parses the correct license information from classifier for platformdirs, license: null', () => {
      const registryData = JSON.parse(fs.readFileSync('test/fixtures/pypi/registryData-info_platformdirs-4.2.0.json'))
      const declared = fetch._extractDeclaredLicense(registryData)
      expect(declared).to.be.equal('MIT')
    })

    it('parses the correct license information from classifier for sacremoses: license: ""', () => {
      const registryData = JSON.parse(fs.readFileSync('test/fixtures/pypi/registryData-info_sacremoses-0.0.51.json'))
      const declared = fetch._extractDeclaredLicense(registryData)
      expect(declared).to.be.equal('MIT')
    })

    it('parses the correct license information from classifier for chardet, license: LGPL, classifier: LGPLv2+', () => {
      const registryData = JSON.parse(fs.readFileSync('test/fixtures/pypi/registryData-info_chardet-5.1.0.json'))
      const declared = fetch._extractDeclaredLicense(registryData)
      expect(declared).to.be.equal('LGPL-2.0-or-later')
    })

    it('parses the correct license information from classifier for pygobject, license: GNU LGPL, classifier: LGPLv2+', () => {
      const registryData = JSON.parse(fs.readFileSync('test/fixtures/pypi/registryData-info_pygobject-3.42.0.json'))
      const declared = fetch._extractDeclaredLicense(registryData)
      expect(declared).to.be.equal('LGPL-2.0-or-later')
    })

    it('parses the correct license information from classifier for oslo.context: license: "", classifier: Apache Software License', () => {
      const registryData = JSON.parse(fs.readFileSync('test/fixtures/pypi/registryData-info_oslo.context-3.4.0.json'))
      const declared = fetch._extractDeclaredLicense(registryData)
      expect(declared).to.be.equal('Apache-2.0')
    })

    it('parses the correct license information for pywin32: PSF', () => {
      const registryData = JSON.parse(fs.readFileSync('test/fixtures/pypi/registryData-info_pywin32-303.json'))
      const declared = fetch._extractDeclaredLicense(registryData)
      expect(declared).to.be.equal('PSF-2.0')
    })

    it('parses the correct license information for numba: BSD in license and classifier', () => {
      const registryData = JSON.parse(fs.readFileSync('test/fixtures/pypi/registryData-info_numba-0.56.0.json'))
      const declared = fetch._extractDeclaredLicense(registryData)
      expect(declared).to.be.equal('BSD-2-Clause')
    })
  })

  describe('test spdxCorrect', () => {
    it('parses correct LGPL license information', () => {
      // See https://github.com/jslicense/spdx-correct.js/blob/main/test.js
      const conversions = {
        'GNU LESSER GENERAL PUBLIC LICENSE': 'LGPL-2.1-only',
        'LESSER GENERAL PUBLIC LICENSE': 'LGPL-2.1-only',
        'GNU Lesser General Public License v2.1': 'LGPL-2.1-only',
        'GNU Lesser General Public License v3': 'LGPL-3.0-or-later',
        'GNU Lesser General Public License v2': 'LGPL-2.0-only',
        'GNU Lesser General Public License v2.0': 'LGPL-2.0-only',
        'GNU Lesser General Public License v3.0': 'LGPL-3.0-or-later',
        'GNU LGPL v3.0': 'LGPL-3.0-or-later',
        '(LGPL)': 'LGPL-3.0-or-later',
        LGLP3: 'LGPL-3.0-or-later',
        'LGPL 2.1': 'LGPL-2.1-only',
        'LGPL 3': 'LGPL-3.0-or-later',
        'LGPL 3.0': 'LGPL-3.0-or-later',
        'LGPL Version 3.0': 'LGPL-3.0-or-later',
        'LGPL v2': 'LGPL-2.0-only',
        'LGPL v2+': 'LGPL-2.0-or-later',
        'LGPL v3': 'LGPL-3.0-or-later',
        LGPL: 'LGPL-3.0-or-later',
        'LGPL-2': 'LGPL-2.0-only',
        'LGPL-3': 'LGPL-3.0-or-later',
        'LGPL.v3': 'LGPL-3.0-or-later',
        LGPL2: 'LGPL-2.0-only',
        'LGPL2.1': 'LGPL-2.1-only',
        'LGPL2.1+': 'LGPL-2.1-or-later',
        LGPL3: 'LGPL-3.0-or-later',
        'LGPL3+': 'LGPL-3.0-or-later',
        'LGPL3.0': 'LGPL-3.0-or-later',
        'LGPL:': 'LGPL-3.0-or-later',
        'LGPLv2.1': 'LGPL-2.1-only',
        LGPLv3: 'LGPL-3.0-or-later',
        'LGPLv3+': 'LGPL-3.0-or-later',
        'LGPL-2.0+': 'LGPL-2.0-or-later',
        'LGPL-2.1+': 'LGPL-2.1-or-later',
        'LGPL-3.0+': 'LGPL-3.0-or-later'
      }
      for (const [key, value] of Object.entries(conversions)) {
        expect(spdxCorrect(key)).to.be.equal(value)
      }
    })

    it('parses the correct license information with patching', () => {
      let declared = spdxCorrect('GNU Lesser General Public License v2 (LGPLv2)')
      expect(declared).to.be.equal('LGPL-2.0-only')

      declared = spdxCorrect('GNU Lesser General Public License v2 or later (LGPLv2+)')
      expect(declared).to.be.equal('LGPL-2.0-or-later')

      //Previously patched cases
      declared = spdxCorrect('GNU Lesser General Public License v3 (LGPLv3)')
      expect(declared).to.be.equal('LGPL-3.0-or-later')

      declared = spdxCorrect('GNU LGPL')
      expect(declared).to.be.equal('LGPL-3.0-or-later')
    })
  })
})

const getCompressedFile = () => {
  const response = new PassThrough()
  const file = 'test/fixtures/maven/swt-3.3.0-v3346.jar'
  response.write(fs.readFileSync(file))
  response.statusCode = 200
  response.end()
  return response
}
