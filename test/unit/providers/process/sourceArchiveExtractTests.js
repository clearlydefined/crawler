// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const SourceArchiveExtract = require('../../../../providers/process/sourcearchiveExtract')
const Request = require('../../../../ghcrawler').request

const pomsArray = [{ pom1: 'pom1' }, { pom2: 'pom2' }]
const summaryObj = { version: '8.1.0' }

describe('SourceArchiveExtract Tests', () => {
  let processor, request
  beforeEach(async () => {
    ;({ processor, request } = await setup())
  })

  afterEach(() => {
    request.getTrackedCleanups().forEach(cleanup => cleanup())
  })

  it('verifies the version of the source archive extract', () => {
    expect(processor._schemaVersion).to.equal('1.4.0')
  })

  it('handles a source archive request', () => {
    expect(processor.canHandle(request)).to.be.true
  })

  it('extracts the release date, summary and poms sections', async () => {
    await processor.handle(request)
    expect(request.document.manifest.summary).to.be.deep.equal(summaryObj)
    expect(request.document.manifest.poms).to.be.deep.equal(pomsArray)
    expect(request.document.releaseDate).to.be.equal('2021-08-01T00:00:00.000Z')
  })
})

async function setup() {
  const processor = SourceArchiveExtract({ logger: {} })
  const request = createRequest()
  const dir = processor.createTempDir(request)
  request.document.location = dir.name
  request.document.summary = { ...summaryObj }
  request.document.poms = [...pomsArray]
  request.document.releaseDate = '2021-08-01T00:00:00.000Z'
  return { processor, request }
}

function createRequest() {
  const request = new Request('clearlydefined', 'cd:/sourcearchive/mavencentral/org.osgi/osgi.annotation/8.1.0')
  request.document = { _metadata: { links: {} }, registryData: { manifest: {} } }
  return request
}
