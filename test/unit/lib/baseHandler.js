// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const proxyquire = require('proxyquire')
const sinon = require('sinon')
const sandbox = sinon.createSandbox()
const deepEqualInAnyOrder = require('deep-equal-in-any-order')
const chai = require('chai')
chai.use(deepEqualInAnyOrder)
const { expect } = chai
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
    expect(document.interestingFiles.length).to.equal(12)
    expect(document.interestingFiles.map(file => file.path)).to.deep.equalInAnyOrder(
      Object.getOwnPropertyNames(Handler._globResult.result)
    )
    validateInterestingFile('license', document.interestingFiles)
    validateInterestingFile('LICENSE.HTML', document.interestingFiles)
    validateInterestingFile('NOtices', document.interestingFiles)
    validateInterestingFile('notice.TXT', document.interestingFiles)
  })

  it('handles no files found', async () => {
    Handler._globResult.result = {}
    const document = {}
    await Handler.addInterestingFiles(document, '')
    expect(document.interestingFiles).to.be.undefined
  })
})

describe('BaseHandler filesystem integration', () => {
  it('actually works on files and does not include extras', async () => {
    const document = {}
    await BaseHandler.addInterestingFiles(document, path.join(__dirname, '../..', 'fixtures/package1'))
    expect(document.interestingFiles.length).to.equal(3)
    validateInterestingFile('license', document.interestingFiles)
    validateInterestingFile('NOTICES', document.interestingFiles)
    validateInterestingFile('License.txt', document.interestingFiles)
  })
})

function validateInterestingFile(name, list) {
  const content = `${name} content`
  const token = BaseHandler.computeToken(content)
  const entry = find(list, entry => entry.path === name)
  expect(!!entry).to.be.true
  expect(entry.token).to.equal(token)
  expect(entry.content).to.equal(content)
}
