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
    const result = await setup()
    processor = result.processor
    request = result.request
  })

  it('should verify version of source archive extract', () => {
    expect(processor._schemaVersion).to.equal('1.4.0')
  })

  it('checks the summary and poms section in clearlydefined result', async () => {
    await processor.handle(request)
    expect(request.document.manifest.summary).to.be.deep.equal(summaryObj)
    expect(request.document.manifest.poms).to.be.deep.equal(pomsArray)
  })
})

async function setup() {
  const processor = SourceArchiveExtract({ logger: {} })
  const request = createRequest()
  const dir = processor.createTempDir(request)
  request.document.location = dir.name
  request.document.summary = summaryObj
  request.document.poms = pomsArray
  return { processor, request }
}

function createRequest() {
  const request = new Request('source', 'cd:/sourcearchive/mavencentral/org.osgi/osgi.annotation/8.1.0')
  request.document = { _metadata: { links: {} }, registryData: { manifest: {} } }
  return request
}
