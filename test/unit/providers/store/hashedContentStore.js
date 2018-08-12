// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const factory = require('../../../../providers/store/hashedContentFactory')
const { describe, it } = require('mocha')
const expect = chai.expect
const sinon = require('sinon')

describe('HashedContentStore', () => {
  it('have properly structured metadata', async () => {
    const { store } = setup()
    const document = {
      _metadata: { fetchedAt: 'now', processedAt: 'then', extra: 'value' },
      _fileContent: [{ token: '42', content: '42 content' }, { token: '13', content: '13 content' }]
    }
    await store.upsert(document)
    const baseStore = store.baseStore
    expect(baseStore.upsert.calledTwice).to.be.true

    var storedDoc = baseStore.upsert.getCall(0).args[0]
    var metadata = storedDoc._metadata
    expect(metadata.type).to.be.eq('content')
    expect(metadata.fetchedAt).to.be.eq('now')
    expect(metadata.processedAt).to.be.eq('then')
    expect(metadata.extra).to.be.undefined
    expect(metadata.links.self.href).to.be.eq('urn:content:42')
    expect(metadata.url).to.be.eq('cd:/content/42')
    var content = storedDoc.content
    expect(content).to.be.eq('42 content')

    var storedDoc = baseStore.upsert.getCall(1).args[0]
    metadata = storedDoc._metadata
    expect(metadata.type).to.be.eq('content')
    expect(metadata.fetchedAt).to.be.eq('now')
    expect(metadata.processedAt).to.be.eq('then')
    expect(metadata.extra).to.be.undefined
    expect(metadata.links.self.href).to.be.eq('urn:content:13')
    expect(metadata.url).to.be.eq('cd:/content/13')
    content = storedDoc.content
    expect(content).to.be.eq('13 content')
  })

  it('should do nothing if no files', async () => {
    const { store } = setup()
    const document = {}
    await store.upsert(document)
    const baseStore = store.baseStore
    expect(baseStore.upsert.notCalled).to.be.true
  })
})

function setup() {
  const realFactory = () => {
    return { upsert: sinon.stub() }
  }
  const store = factory(realFactory)({})
  return { store }
}
