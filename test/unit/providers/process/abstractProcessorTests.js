// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const proxyquire = require('proxyquire')
const path = require('path')
const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const chai = require('chai')
const expect = chai.expect
const { find } = require('lodash')
const AbstractProcessor = require('../../../../providers/process/abstractProcessor')
const Request = require('../../../../ghcrawler').request
const VisitorMap = require('../../../../ghcrawler').visitorMap
const map = require('../../../../config/map')

let Handler

describe('AbstractProcessor aggregateVersions', () => {
  it('version aggregation with one version', () => {
    const result = new AbstractProcessor({}).aggregateVersions(['1.2.3'], 'should not happen')
    expect(result).to.equal('1.2.3')
  })

  it('version aggregation with multiple versions', () => {
    const result = new AbstractProcessor({}).aggregateVersions(['1.2.3', '2.3.4'], 'should not happen')
    expect(result).to.equal('3.5.7')
  })

  it('version aggregation should fail with long versions', () => {
    try {
      new AbstractProcessor({}).aggregateVersions(['1.2.3', '2.3.4.5'], 'should not happen')
      expect(false).to.be.true
    } catch (error) {
      expect(error.message.includes('should not happen')).to.be.true
    }
  })

  it('version aggregation should fail with non-numeric versions', () => {
    try {
      new AbstractProcessor({}).aggregateVersions(['1.2.3', '2.3.b34'], 'should not happen')
      expect(false).to.be.true
    } catch (error) {
      expect(error.message.includes('should not happen')).to.be.true
    }
  })

  it('version collection includes all superclasses', () => {
    const foo = class Foo extends AbstractProcessor {
      get toolVersion() {
        return '1.2.3'
      }
    }
    const bar = class Bar extends foo {
      get toolVersion() {
        return '2.3.4'
      }
    }
    const handler = new bar({})

    expect(handler._schemaVersion).to.equal('3.7.7') // AbstractProcessor is at '0.2.0' now ;)
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

  it('handles attaching no files', async () => {
    const document = {}
    await Handler.attachFiles(document, [])
    expect(document.attachments).to.be.undefined
  })
})

describe('link and queue local tasks', () => {
  let processor

  beforeEach(() => {
    processor = new AbstractProcessor({})
    processor.linkAndQueueTool = sinon.stub()
  })

  it('link and queue one local task', () => {
    const request = new Request('npm', 'cd:/npm/npmjs/-/redie/0.3.0')
    processor.addLocalToolTasks(request, 'clearlydefined')
    expect(processor.linkAndQueueTool.calledOnce).to.be.true
    expect(processor.linkAndQueueTool.args[0][0].type).to.be.equal('npm')
    expect(processor.linkAndQueueTool.args[0][1]).to.be.equal('clearlydefined')
    expect(processor.linkAndQueueTool.args[0][3]).to.be.equal('local')
  })

  it('link and queue two local tasks', () => {
    const request = new Request('npm', 'cd:/npm/npmjs/-/redie/0.3.0')
    processor.addLocalToolTasks(request, 'clearlydefined', 'licensee')

    expect(processor.linkAndQueueTool.callCount).to.be.equal(2)
    expect(processor.linkAndQueueTool.args[0][0].type).to.be.equal('npm')
    expect(processor.linkAndQueueTool.args[0][1]).to.be.equal('clearlydefined')
    expect(processor.linkAndQueueTool.args[0][3]).to.be.equal('local')

    expect(processor.linkAndQueueTool.args[1][0].type).to.be.equal('npm')
    expect(processor.linkAndQueueTool.args[1][1]).to.be.equal('licensee')
    expect(processor.linkAndQueueTool.args[1][3]).to.be.equal('local')
  })

  it('link and queue default local tasks', () => {
    const request = new Request('npm', 'cd:/npm/npmjs/-/redie/0.3.0')
    processor.addLocalToolTasks(request)
    expect(processor.linkAndQueueTool.callCount).to.be.equal(1)
    expect(processor.linkAndQueueTool.args.map(call => call[1])).to.have.members([
      //'licensee',
      'scancode',
      //'reuse'
    ])
  })
})

describe('AbstractProcessor get interesting files', () => {
  it('filters out uninteresting files', async () => {
    const processor = new AbstractProcessor({})
    processor.getFiles = () => ['/test/.git/license', '']
    const files = await processor.filterFiles('/test')
    expect(files.length).to.be.equal(0)
  })

  it('filter finds files recursively', async () => {
    const processor = new AbstractProcessor({})
    const files = await processor.filterFiles(path.resolve(__dirname, '../../../fixtures/recursivedir'))
    expect(files).to.deep.equal(['a/b/fileb', 'a/filea', 'file1'])
  })

  it('filter finds no files give a file', async () => {
    const processor = new AbstractProcessor({})
    const files = await processor.filterFiles(path.resolve(__dirname, '../../../fixtures/recursivedir/file1'))
    expect(files).to.deep.equal([])
  })

  it('finds folders recursively', async () => {
    const processor = new AbstractProcessor({})
    const root = path.resolve(__dirname, '../../../fixtures/recursivedir')
    const files = await processor.getFolders(root)
    expect(files).to.deep.equal([path.join(root, 'a'), path.join(root, 'a/b')])
  })

  it('finds folders and ignores', async () => {
    const processor = new AbstractProcessor({})
    const root = path.resolve(__dirname, '../../../fixtures/recursivedir')
    const files = await processor.getFolders(root, ['/b'])
    expect(files).to.deep.equal([path.join(root, 'a')])
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
