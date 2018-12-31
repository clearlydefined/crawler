// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const proxyquire = require('proxyquire')
const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const chai = require('chai')
const expect = chai.expect
const { find } = require('lodash')
const AbstractProcessor = require('../../../../providers/process/abstractProcessor')

let Handler

describe('AbstractProcessor attach files', () => {
  beforeEach(function() {
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

  afterEach(function() {
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
