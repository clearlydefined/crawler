// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const AbstractCDProcessor = require('../../../../providers/process/abstractClearlyDefinedProcessor')
const sinon = require('sinon')
const chai = require('chai')
const expect = chai.expect

describe('AbstractClearlyDefinedProcessor interesting file identification', () => {
  it('finds files it should', () => {
    const files = ['license', 'License.md', 'LICENSE.HTML', 'LICENSE.txt']
    const processor = new AbstractCDProcessor({})
    files.forEach(file => expect(processor._isInterestinglyNamed(file)).to.be.true)
  })

  it('does not fine files it should not', () => {
    const files = ['licenser', 'Licenset.md', 'test.HTML', 'LICENSE.doc']
    const processor = new AbstractCDProcessor({})
    files.forEach(file => expect(processor._isInterestinglyNamed(file)).to.be.false)
  })
})

describe('AbstractClearlyDefinedProcessor add files', () => {
  it('adds files at the root and in folders', async () => {
    const processor = new AbstractCDProcessor({})
    processor.getFiles = () => ['/test/license', '/test/package/notice.txt']
    processor.attachFiles = sinon.stub()
    processor.computeHashes = () => {
      return { sha1: '42' }
    }
    const document = { location: '/test' }
    await processor._addFiles({ document })
    expect(document.files.length).to.be.equal(2)
    expect(document.files.map(file => file.path)).to.have.members(['license', 'package/notice.txt'])
    expect(document.files.every(file => file.hashes.sha1 === '42')).to.be.true
    expect(processor.attachFiles.callCount).to.be.equal(2)
  })

  it('normalizes windows paths', async () => {
    const processor = new AbstractCDProcessor({})
    processor.getFiles = () => ['c:\\test\\license', 'c:\\test\\package\\notice.txt']
    processor.attachFiles = sinon.stub()
    processor.computeHashes = sinon.stub()
    const document = { location: 'c:\\test' }
    await processor._addFiles({ document })
    expect(document.files.map(file => file.path)).to.have.members(['license', 'package/notice.txt'])
  })

  it('handles no files', async () => {
    const processor = new AbstractCDProcessor({})
    processor.getFiles = () => []
    processor.attachFiles = sinon.stub()
    processor.computeHashes = sinon.stub()
    const document = { location: '/test' }
    await processor._addFiles({ document })
    expect(document.files.length).to.be.equal(0)
    expect(processor.attachFiles.callCount).to.be.equal(0)
  })

  it('filters out uninteresting files', async () => {
    const processor = new AbstractCDProcessor({})
    processor.getFiles = () => ['/test/.git/license', '']
    processor.attachFiles = sinon.stub()
    processor.computeHashes = sinon.stub()
    const document = { location: '/test' }
    await processor._addFiles({ document })
    expect(document.files.length).to.be.equal(0)
    expect(processor.attachFiles.callCount).to.be.equal(0)
  })
})
