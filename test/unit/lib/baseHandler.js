// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const proxyquire = require('proxyquire')
const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const chai = require('chai')
const expect = chai.expect
const BaseHandler = require('../../../lib/baseHandler')
const path = require('path')
const { find } = require('lodash')

let Handler

describe('BaseHandler interesting file discovery', () => {
  beforeEach(function() {
    const resultBox = { result: null, fsresult: null }
    const globStub = () => Promise.resolve(Object.keys(resultBox.result))
    const fsStub = {
      readFileSync: path => (resultBox.fsresult ? resultBox.fsresult[path] : resultBox.result[path]) || 'foo'
    }
    Handler = proxyquire('../../../lib/baseHandler', { fs: fsStub, 'fast-glob': globStub, child_process: execStub() })
    Handler._globResult = resultBox
  })

  afterEach(function() {
    sandbox.restore()
  })

  it('finds multiple files', async () => {
    Handler._globResult.result = {
      license: 'license attachment',
      'License.md': 'License.md attachment',
      'LICENSE.HTML': 'LICENSE.HTML attachment',
      'license.txt': 'license.txt attachment',
      NOtice: 'NOtice attachment',
      'Notice.md': 'Notice.md attachment',
      'notice.TXT': 'notice.TXT attachment',
      'notice.html': 'notice.html attachment',
      NOtices: 'NOtices attachment',
      'Notices.md': 'Notices.md attachment',
      'notices.TXT': 'notices.TXT attachment',
      'notices.html': 'notices.html attachment'
    }
    const document = {}
    await Handler.attachInterestinglyNamedFiles(document, '')
    expect(document.attachments.length).to.eq(12)
    expect(document._attachments.length).to.eq(12)

    validateInterestingFile('license', document.attachments)
    validateInterestingFile('LICENSE.HTML', document._attachments, true)
    validateInterestingFile('NOtices', document.attachments)
    validateInterestingFile('notice.TXT', document._attachments, true)
  })

  it('finds files in a folder', async () => {
    Handler._globResult.result = {
      'License.md': 'License.md attachment',
      'LICENSE.HTML': 'LICENSE.HTML attachment',
      'license.txt': 'license.txt attachment',
      'Notice.md': 'Notice.md attachment'
    }
    Handler._globResult.fsresult = {
      [createPath('License.md')]: 'License.md attachment',
      [createPath('LICENSE.HTML')]: 'LICENSE.HTML attachment',
      [createPath('license.txt')]: 'license.txt attachment',
      [createPath('Notice.md')]: 'Notice.md attachment'
    }
    const document = {}
    await Handler.attachInterestinglyNamedFiles(document, '', 'package')
    expect(document.attachments.length).to.eq(4)
    expect(document._attachments.length).to.eq(4)

    validateInterestingFile(createPath('License.md'), document.attachments)
    validateInterestingFile(createPath('LICENSE.HTML'), document._attachments, true)
    validateInterestingFile(createPath('license.txt'), document.attachments)
    validateInterestingFile(createPath('Notice.md'), document._attachments, true)
  })

  it('handles no files found', async () => {
    Handler._globResult.result = {}
    const document = {}
    await Handler.attachInterestinglyNamedFiles(document, '')
    expect(document.attachments).to.be.undefined
  })
})

function createPath(name) {
  return `package${path.sep}${name}`
}

describe('BaseHandler filesystem integration', () => {
  it('actually works on files', async () => {
    const document = {}
    await proxyquire('../../../lib/baseHandler', { child_process: execStub() }).attachInterestinglyNamedFiles(
      document,
      path.join(__dirname, '../..', 'fixtures/package1')
    )
    expect(document.attachments.length).to.eq(3)
    validateInterestingFile('license', document.attachments)
    validateInterestingFile('NOTICES', document._attachments, true)
    validateInterestingFile('NOTICES', document.attachments)
    validateInterestingFile('License.txt', document._attachments, true)
  })
})

function validateInterestingFile(name, list, checkContent = false) {
  const attachment = `${path.basename(name)} attachment`
  const token = BaseHandler.computeToken(attachment)
  const entry = find(list, entry => entry.path === name)
  expect(!!entry).to.be.true
  expect(entry.token).to.eq(token)
  if (checkContent) expect(entry.attachment).to.eq(attachment)
}

function execStub() {
  return {
    exec: (cmd, callback) => {
      if (cmd.startsWith('licensee ')) return callback(null, '{ "licenses": [{ "spdx_id": "MIT" }] }')
      throw new Error('exec not stubbed')
    }
  }
}
