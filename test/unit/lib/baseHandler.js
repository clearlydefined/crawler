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
  beforeEach(function () {
    const resultBox = { result: null }
    const globStub = async (glob, options, callback) => callback(null, Object.keys(resultBox.result))
    const fsStub = { readFileSync: path => resultBox.result[path] || 'foo' }
    Handler = proxyquire('../../../lib/baseHandler', { fs: fsStub, glob: globStub, child_process: execStub() })
    Handler._globResult = resultBox
  })

  afterEach(function () {
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
    await Handler.addInterestingFiles(document, '')
    expect(document.interestingFiles.length).to.eq(12)
    expect(document._attachments.length).to.eq(12)

    validateInterestingFile('license', document.interestingFiles)
    validateInterestingFile('LICENSE.HTML', document._attachments, true)
    validateInterestingFile('NOtices', document.interestingFiles)
    validateInterestingFile('notice.TXT', document._attachments, true)
  })

  it('handles no files found', async () => {
    Handler._globResult.result = {}
    const document = {}
    await Handler.addInterestingFiles(document, '')
    expect(document.interestingFiles).to.be.undefined
  })
})

describe('BaseHandler filesystem integration', () => {
  it('actually works on files', async () => {
    const document = {}
    await proxyquire('../../../lib/baseHandler', { child_process: execStub() })
      .addInterestingFiles(document, path.join(__dirname, '../..', 'fixtures/package1'))
    expect(document.interestingFiles.length).to.eq(3)
    validateInterestingFile('license', document.interestingFiles)
    validateInterestingFile('NOTICES', document._attachments, true)
    validateInterestingFile('NOTICES', document.interestingFiles)
    validateInterestingFile('License.txt', document._attachments, true)
  })
})

function validateInterestingFile(name, list, checkContent = false) {
  const attachment = `${name} attachment`
  const token = BaseHandler.computeToken(attachment)
  const entry = find(list, entry => entry.path === name)
  expect(!!entry).to.be.true
  expect(entry.token).to.eq(token)
  if (checkContent) expect(entry.attachment).to.eq(attachment)
}

function execStub() {
  return {
    exec: (cmd, callback) => {
      if (cmd.startsWith('licensee '))
        return callback(null, '{ "licenses": [{ "spdx_id": "MIT" }] }')
      throw new Error('exec not stubbed')
    }
  }
}
