// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const proxyquire = require('proxyquire')
const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const assert = require('assert')
const BaseHandler = require('../../../lib/baseHandler')
const path = require('path')
const { find } = require('lodash')

var Handler

describe('BaseHandler interesting file discovery', () => {
  beforeEach(function() {
    const resultBox = { result: null }
    const globStub = async (glob, options, callback) => callback(null, Object.keys(resultBox.result))
    const fsStub = { readFileSync: path => resultBox.result[path] || 'foo' }
    Handler = proxyquire('../../../lib/baseHandler', { fs: fsStub, glob: globStub })
    Handler._globResult = resultBox
  })

  afterEach(function() {
    sandbox.restore()
  })

  it('finds multiple files', async () => {
    Handler._globResult.result = {
      license: 'license content',
      'License.md': 'License.md content',
      'LICENSE.HTML': 'LICENSE.HTML content',
      'license.txt': 'license.txt content',
      NOtice: 'NOtice content',
      'Notice.md': 'Notice.md content',
      'notice.TXT': 'notice.TXT content',
      'notice.html': 'notice.html content',
      NOtices: 'NOtices content',
      'Notices.md': 'Notices.md content',
      'notices.TXT': 'notices.TXT content',
      'notices.html': 'notices.html content'
    }
    const document = {}
    await Handler.addInterestingFiles(document, '')
    assert.equal(12, document.interestingFiles.length)
    assert.equal(12, document._fileContent.length)
    validateInterestingFile('license', document.interestingFiles)
    validateInterestingFile('LICENSE.HTML', document._fileContent, true)
    validateInterestingFile('NOtices', document.interestingFiles)
    validateInterestingFile('notice.TXT', document._fileContent, true)
  })

  it('handles no files found', async () => {
    Handler._globResult.result = {}
    const document = {}
    await Handler.addInterestingFiles(document, '')
    assert.equal(undefined, document.interestingFiles)
  })
})

describe('BaseHandler filesystem integration', () => {
  it('actually works on files', async () => {
    const document = {}
    await BaseHandler.addInterestingFiles(document, path.join(__dirname, '../..', 'fixtures/package1'))
    assert.equal(3, document.interestingFiles.length)
    validateInterestingFile('license', document.interestingFiles)
    validateInterestingFile('NOTICES', document._fileContent, true)
    validateInterestingFile('NOTICES', document.interestingFiles)
    validateInterestingFile('License.txt', document._fileContent, true)
  })
})

function validateInterestingFile(name, list, checkContent = false) {
  const content = `${name} content`
  const token = BaseHandler.computeToken(content)
  const entry = find(list, entry => entry.path === name)
  assert.equal(true, !!entry)
  assert.equal(token, entry.token)
  if (checkContent) assert.equal(content, entry.content)
}
