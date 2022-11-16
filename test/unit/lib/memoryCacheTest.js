// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const expect = require('chai').expect
const sinon = require('sinon')
const MemoryCache = require('../../../lib/memoryCache')
const Cache = require('memory-cache').Cache

class TestMemoryCache extends MemoryCache {
  constructor() {
    super({ defaultTtlSeconds: 0.01 }, new Cache())
  }

  withVerify(verify) {
    this._verify = verify
  }

  _wrapTimeoutCallback(timeoutCallback, key, value) {
    timeoutCallback && timeoutCallback(key, value)
    this._verify()
  }

  set(item, value, timeoutCallback) {
    super.set(item, value, this._wrapTimeoutCallback.bind(this, timeoutCallback))
  }
}

describe('cache timeout callback', () => {
  let cache

  beforeEach(() => {
    cache = new TestMemoryCache()
  })

  const verifyExpired = (done, afterExpire) => {
    expect(cache.get('a')).not.to.be.ok
    afterExpire && expect(afterExpire.calledOnce).to.be.true
    done()
  }

  it('should expire', (done) => {
    cache.withVerify(verifyExpired.bind(undefined, done))

    cache.set('a', 'A')
    expect(cache.get('a')).to.be.equal('A')
  })

  it('should expire with no condition', (done) => {
    cache.withVerify(verifyExpired.bind(undefined, done))

    cache.setWithConditionalExpiry('a', 'A')
    expect(cache.get('a')).to.be.equal('A')
  })

  it('should trigger callback after expiry', (done) => {
    const afterExpire = sinon.stub()
    cache.withVerify(verifyExpired.bind(undefined, done, afterExpire))

    cache.setWithConditionalExpiry('a', 'A', afterExpire)
    expect(cache.get('a')).to.be.equal('A')
  })

  it('should expire from condition', (done) => {
    const afterExpire = sinon.stub()
    cache.withVerify(verifyExpired.bind(undefined, done, afterExpire))

    cache.setWithConditionalExpiry('a', 'A', afterExpire, () => true)
    expect(cache.get('a')).to.be.equal('A')
  })

  it('should not expire from condition', (done) => {
    const afterExpire = sinon.stub()
    const verifyNotExpired = () => {
      expect(afterExpire.called).to.be.false
      expect(cache.get('a')).to.be.equal('A')

      //remove entry to prevent clean up being fired again.
      cache.delete('a')
      done()
    }
    cache.withVerify(verifyNotExpired)

    cache.setWithConditionalExpiry('a', 'A', afterExpire, () => false)
    expect(cache.get('a')).to.be.equal('A')
  })

  it('should not expire 1st time and then expire 2nd time', (done) => {
    const afterExpire = sinon.stub()

    let callCount = 0
    const shouldExpire = () => {
      return callCount >= 1
    }
    const verifyNotExpiredFirstThenExpired = () => {
      switch (callCount) {
        case 0:
          expect(afterExpire.called).to.be.false
          expect(cache.get('a')).to.be.equal('A')
          break
        case 1:
          expect(afterExpire.called).to.be.true
          expect(cache.get('a')).not.to.be.ok
          done()
          break
        default:
          expect(false).to.be.true
          done()
      }
      callCount ++
    }
    cache.withVerify(verifyNotExpiredFirstThenExpired)

    cache.setWithConditionalExpiry('a', 'A', afterExpire, shouldExpire)
    expect(cache.get('a')).to.be.equal('A')
  })
})