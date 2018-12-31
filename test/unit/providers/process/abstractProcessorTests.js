// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const proxyquire = require('proxyquire')
const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const chai = require('chai')
const expect = chai.expect
const { find } = require('lodash')
const AbstractProcessor = require('../../../../providers/process/abstractProcessor')
const Request = require('ghcrawler').request
const VisitorMap = require('ghcrawler').visitorMap
const map = require('../../../../config/map')

let Handler

describe('AbstractProcessor attach files', () => {
  it('links and queues tools', () => {
    const request = new Request('npm', 'cd:/npm/npmjs/-/redie/0.3.0')
    request.document = { _metadata: { links: {} } }
    request.crawler = { queue: sinon.stub() }
    request.track = sinon.stub()
    Object.getOwnPropertyNames(map).forEach(name => VisitorMap.register(name, map[name]))
    new AbstractProcessor({}).linkAndQueueTool(request, 'licensee')
    expect(request.document._metadata.links.licensee.href).to.be.equal(
      'urn:npm:npmjs:-:redie:revision:0.3.0:tool:licensee'
    )
    expect(request.document._metadata.links.licensee.type).to.be.equal('collection')
    expect(request.crawler.queue.calledOnce).to.be.true
    expect(request.crawler.queue.args[0][0][0].type).to.be.equal('licensee')
    expect(request.crawler.queue.args[0][0][0].url).to.be.equal(request.url)
  })

  it('links and queues', () => {
    const request = new Request('npm', 'cd:/npm/npmjs/-/redie/0.3.0')
    request.document = { _metadata: { links: {} } }
    request.crawler = { queue: sinon.stub() }
    request.track = sinon.stub()
    Object.getOwnPropertyNames(map).forEach(name => VisitorMap.register(name, map[name]))
    new AbstractProcessor({}).linkAndQueue(request, 'source')
    expect(request.document._metadata.links.source.href).to.be.equal('urn:npm:npmjs:-:redie:revision:0.3.0')
    expect(request.document._metadata.links.source.type).to.be.equal('resource')
    expect(request.crawler.queue.calledOnce).to.be.true
    expect(request.crawler.queue.args[0][0][0].type).to.be.equal('source')
    expect(request.crawler.queue.args[0][0][0].url).to.be.equal(request.url)
  })

  it('add self link', () => {
    const request = new Request('npm', 'cd:/npm/npmjs/-/redie/0.3.0')
    request.document = { _metadata: { links: {} } }
    request.crawler = { queue: sinon.stub() }
    request.track = sinon.stub()
    Object.getOwnPropertyNames(map).forEach(name => VisitorMap.register(name, map[name]))
    new AbstractProcessor({}).addSelfLink(request)
    expect(request.document._metadata.links.self.href).to.be.equal('urn:npm:npmjs:-:redie:revision:0.3.0')
    expect(request.document._metadata.links.self.type).to.be.equal('resource')
    expect(request.crawler.queue.callCount).to.equal(0)
  })
})

describe('AbstractProcessor attach files', () => {
  beforeEach(() => {
    const fsStub = {
      readFileSync: path => {
        path = path.replace(/\\/g, '/')
        return `${path.startsWith('/test') ? path.slice(6) : path} attachment`
      }
    }
    const handlerClass = proxyquire('../../../../providers/process/abstractProcessor', {
      fs: fsStub
    })
    Handler = new handlerClass({})
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('attaches multiple files', async () => {
    const document = {}
    await Handler.attachFiles(document, ['package/license', 'LICENSE.HTML'], '/test')
    validateAttachedFile('package/license', document.attachments)
    validateAttachedFile('LICENSE.HTML', document._attachments, true)
  })

  it('attaches files with no location', async () => {
    const document = {}
    await Handler.attachFiles(document, ['package/license', 'LICENSE.HTML'])
    validateAttachedFile('package/license', document.attachments)
    validateAttachedFile('LICENSE.HTML', document._attachments, true)
  })

  it('handles attaching no files', async () => {
    const document = {}
    await Handler.attachFiles(document, [])
    expect(document.attachments).to.be.undefined
  })
})

describe('AbstractProcessor get interesting files', () => {
  it('filters out uninteresting files', async () => {
    const processor = new AbstractProcessor({})
    processor.getFiles = () => ['/test/.git/license', '']
    const files = await processor.getInterestingFiles('/test')
    expect(files.length).to.be.equal(0)
  })
})

function validateAttachedFile(name, list, checkContent = false) {
  const attachment = `${name} attachment`
  const token = Handler._computeToken(attachment)
  const entry = find(list, entry => entry.path === name)
  expect(!!entry).to.be.true
  expect(entry.token).to.eq(token)
  if (checkContent) expect(entry.attachment).to.eq(attachment)
}
