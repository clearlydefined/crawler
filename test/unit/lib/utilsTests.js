// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const { normalizePath, normalizePaths, trimParents, trimAllParents, extractDate } = require('../../../lib/utils')

describe('Utils path functions', () => {
  it('normalizes one path', () => {
    expect(normalizePath('c:\\foo\\bar.txt')).to.equal('c:/foo/bar.txt')
    expect(normalizePath('c:\\foo/bar.txt')).to.equal('c:/foo/bar.txt')
    expect(normalizePath('/foo/bar')).to.equal('/foo/bar')
    expect(normalizePath('')).to.equal('')
    expect(normalizePath(null)).to.be.null
    expect(normalizePath()).to.be.undefined
  })

  it('normalizes several paths', () => {
    const results = normalizePaths(['c:\\foo\\bar1.txt', 'c:\\foo/bar.txt', '/foo/bar', '', null, undefined])
    expect(results).to.have.members(['c:/foo/bar1.txt', 'c:/foo/bar.txt', '/foo/bar', '', null, undefined])
    expect(normalizePaths([]).length).to.equal(0)
    expect(normalizePaths('')).to.equal('')
    expect(normalizePaths(null)).to.be.null
    expect(normalizePaths()).to.be.undefined
  })

  it('trims parents from one path', () => {
    expect(trimParents('/foO/Bar', '/foO')).to.equal('Bar')
    expect(trimParents('/foo/bar', '/foo/')).to.equal('bar')
    expect(trimParents('foo/bar', 'foo/')).to.equal('bar')
    expect(trimParents('/foo/bar', '/')).to.equal('foo/bar')
    expect(trimParents('/foo/bar', '/this')).to.equal('/foo/bar')
    expect(trimParents('/foo', '/foo')).to.equal('')
    expect(trimParents('/foo')).to.equal('/foo')

    expect(trimParents('\\foO\\Bar', '/foO')).to.equal('Bar')
    expect(trimParents('\\foo\\bar', '/foo/')).to.equal('bar')
    expect(trimParents('foo\\bar', 'foo/')).to.equal('bar')
    expect(trimParents('\\foo/bar', '/')).to.equal('foo/bar')
    expect(trimParents('\\foo/bar', '/this')).to.equal('/foo/bar')
    expect(trimParents('\\foo', '/foo')).to.equal('')
    expect(trimParents('\\foo')).to.equal('/foo')
  })

  it('trims parents from multiple paths', () => {
    const results = trimAllParents(['\\foo\\Bar1.txt', '\\foo/bar.txt', '/foo/bar', '', null, undefined], '/foo')
    expect(results).to.have.members(['Bar1.txt', 'bar.txt', 'bar', '', null, undefined])
    expect(trimAllParents([], 'foo').length).to.equal(0)
    expect(trimAllParents('', '')).to.equal('')
    expect(trimAllParents(null, 'foo')).to.be.null
    expect(trimAllParents(undefined, 'foo')).to.be.undefined
  })
})

describe('Util extractDate', () => {
  it('handle null', () => {
    expect(extractDate(null)).to.be.null
  })
  it('invalid date', () => {
    expect(extractDate('Created by Maven 3.5.4')).to.be.null
  })
  it('unparseable date', () => {
    expect(extractDate('Thu Jun 18 20:06:26 CEST 2009')).to.be.null
  })
  it('parseable date found in pom properties', () => {
    const parsed = extractDate('Sat Nov 13 19:35:12 GMT+01:00 2010')
    expect(parsed.toJSDate().toISOString()).to.be.eq('2010-11-13T18:35:12.000Z')
  })
  it('parseable date: ISO format', () => {
    const parsed = extractDate('2010-11-13T18:35:12.000Z')
    expect(parsed.toJSDate().toISOString()).to.be.eq('2010-11-13T18:35:12.000Z')
  })
  it('parseable date: provide additional formats', () => {
    const parsed = extractDate('11-13-2010', ['MM-dd-yyyy', 'EEE MMM d yyyy'])
    expect(parsed.toISODate()).to.be.eq('2010-11-13')
  })
})
