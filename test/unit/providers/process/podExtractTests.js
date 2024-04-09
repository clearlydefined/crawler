// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const podExtract = require('../../../../providers/process/podExtract')
const Request = require('../../../../ghcrawler').request
const { expect } = require('chai')

describe('podExtract', () => {
  it('builds the correct self link which reflects the current _schemaVersion of podExtract', async () => {
    const request = new Request('pod', 'cd:/pod/cocoapods/-/SwiftLCS/1.0')
    request.document = { _metadata: { links: {} } }
    createPodExtract().handle(request)
    expect(request.document._metadata.links.self.href).to.be.equal(
      'urn:pod:cocoapods:-:SwiftLCS:revision:1.0:tool:clearlydefined:1.2.0'
    )
    expect(request.document._metadata.links.self.type).to.be.equal('resource')
    expect(request.document._metadata.schemaVersion).to.be.equal('1.2.0')
  })
})

function createPodExtract() {
  const extract = podExtract({})
  extract._createDocument = async () => {}
  extract.isProcessing = () => true
  return extract
}
