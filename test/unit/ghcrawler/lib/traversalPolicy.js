// (c) Copyright 2021, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const { DateTime } = require('luxon')
const TraversalPolicy = require('../../../../ghcrawler/lib/traversalPolicy')

describe('Test hasExpired', () => {
  const hasExpired = TraversalPolicy._hasExpired

  it('handle null', () => {
    expect(hasExpired(null)).to.be.true
  })
  it('expiration is 0', () => {
    expect(hasExpired(DateTime.now())).to.be.true
  })
  it('past expired based on hours', () => {
    const twoHoursAgo = DateTime.now().minus({ hours: 2 }).toISO()
    expect(hasExpired(twoHoursAgo, 1)).to.be.true
  })
  it('past expired based on minutes', () => {
    const twoMinutesAgo = DateTime.now().minus({ minutes: 2 }).toISO()
    expect(hasExpired(twoMinutesAgo, 1, 'minutes')).to.be.true
  })
  it('past not expired', () => {
    const twoMinutesAgo = DateTime.now().minus({ minutes: 2 }).toISO()
    expect(hasExpired(twoMinutesAgo, 1, 'hours')).to.be.false
  })
  it('future', () => {
    const future = DateTime.now().plus({ hours: 2 }).toISO()
    expect(hasExpired(future, 1)).to.be.false
  })
})