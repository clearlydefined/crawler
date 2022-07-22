// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const expect = require('chai').expect
const sinon = require('sinon')
const GoFetch = require('../../../../providers/fetch/goFetch')
const PassThrough = require('stream').PassThrough
const proxyquire = require('proxyquire')
const Request = require('../../../../ghcrawler').request
const fs = require('fs')
const { merge } = require('lodash')

const stub = 'https://proxy.golang.org/'

describe('Go utility functions', () => {
  it('builds URLs', () => {
    const fetch = GoFetch({})
    expect(fetch._buildUrl(spec('go', 'golang', 'cloud.google.com', 'go', 'v0.56.0'))).to.equal(stub + 'cloud.google.com/go/@v/v0.56.0.zip')
    expect(fetch._buildUrl(spec('go', 'golang', 'cloud.google.com', 'go', 'v0.56.0'), '.mod')).to.equal(stub + 'cloud.google.com/go/@v/v0.56.0.mod')
    expect(fetch._buildUrl(spec('go', 'golang', '-', 'collectd.org', 'v0.5.0'))).to.equal(stub + 'collectd.org/@v/v0.5.0.zip')
    expect(fetch._buildUrl(spec('go', 'golang', 'github.com%2fAzure%2fazure-event-hubs-go', 'v3', 'v3.2.0'))).to.equal(stub + 'github.com/Azure/azure-event-hubs-go/v3/@v/v3.2.0.zip')
    expect(fetch._buildUrl(spec('go', 'golang', 'github.com%2FAzure%2Fazure-event-hubs-go', 'v3', 'v3.2.0'))).to.equal(stub + 'github.com/Azure/azure-event-hubs-go/v3/@v/v3.2.0.zip')
  })
})


const hashes = {
  'v1.3.0.zip': {
    sha1: '270d80279fca2d21c401dd40b6fc6370c41bfd94',
    sha256: '03872ee7d6747bc2ee0abadbd4eb09e60f6df17d0a6142264abe8a8a00af50e7'
  }
}

let Fetch

function pickArtifact(url) {

  if (url.endsWith('.mod')) return 'v1.3.0.mod'
  if (url.endsWith('.info')) return 'v1.3.0.info'
  if (url.endsWith('.zip')) return 'v1.3.0.zip'
  if (url.endsWith('list')) return 'list'
  return null
}

describe('Go Proxy fetching', () => {
  let successHttpStub

  beforeEach(() => {
    const requestPromiseStub = options => {
      if (options.url) {
        if (options.url.includes('error')) throw new Error('yikes')
        if (options.url.includes('code')) throw { statusCode: 500, message: 'Code' }
        if (options.url.includes('missing')) throw { statusCode: 404 }
      }

      const file = pickArtifact(options.url)
      const content = fs.readFileSync(`test/fixtures/go/${file}`)
      return options.json ? JSON.parse(content) : content
    }

    const getStub = (url, callback) => {
      const response = new PassThrough()
      const file = `test/fixtures/go/${pickArtifact(url)}`
      if (file) {
        response.write(fs.readFileSync(file))
        callback(null, { statusCode: 200 })
      } else {
        callback(new Error(url.includes('error') ? 'Error' : 'Code'))
      }
      response.end()
      return response
    }
    successHttpStub = {
      get: sinon.stub().returns({
        status: 200,
        data:
          `<article>
            <section class="License" id="lic-0">
              <h2 class="go-textTitle">
              <div id="#lic-0">Apache-2.0</div>
              </h2>
              <p>This is not legal advice. <a href="/license-policy">Read disclaimer.</a></p>
              <pre class="License-contents">                                 Apache License
                                Version 2.0, January 2004
                              http://www.apache.org/licenses/
              </pre>
            </section>
            <section class="License" id="lic-1">
              <h2 class="go-textTitle">
                <div id="#lic-1">BSD-2-Clause, BSD-3-Clause, HPND</div>
              </h2>
              <p>This is not legal advice. <a href="/license-policy">Read disclaimer.</a></p>
              <pre class="License-contents">Copyright (c) 2013-2019 Tommi Virtanen.
                Copyright (c) 2009, 2011, 2012 The Go Authors.
                All rights reserved.
              </pre>
            </section>
          </article>`
      }
      )
    }
    Fetch = proxyquire('../../../../providers/fetch/goFetch', {
      request: { get: getStub },
      'request-promise-native': requestPromiseStub,
    })
  })

  afterEach(function () {
    sinon.restore()
  })

  it('succeeds in download, decompress, hash, and get registry licenses', async () => {
    const handler = Fetch({ logger: { log: sinon.stub(), info: sinon.stub() }, http: successHttpStub })
    const request = await handler.handle(new Request('test', 'cd:/go/golang/rsc.io/quote/v1.3.0'))
    request.fetchResult.copyTo(request)
    expect(request.document.hashes.sha1).to.be.equal(hashes['v1.3.0.zip']['sha1'])
    expect(request.document.hashes.sha256).to.be.equal(hashes['v1.3.0.zip']['sha256'])
    expect(request.document.releaseDate).to.equal('2018-02-14T00:54:53Z')
    expect(request.document.registryData.licenses).to.be.deep.equal(['Apache-2.0', 'BSD-2-Clause, BSD-3-Clause, HPND'])
    expect(request.casedSpec.name).to.equal('quote')
    expect(request.casedSpec.namespace).to.equal('rsc.io')
    expect(request.contentOrigin).to.equal('origin')
    expect(request.url).to.equal('cd:/go/golang/rsc.io/quote/v1.3.0')
  })

  it('queries for the latest version when coordinates are missing a revision', async () => {
    // Versions are listed in test/fixtures/go/list

    const handler = Fetch({ logger: { log: sinon.stub(), info: sinon.stub() }, http: successHttpStub })
    const request = await handler.handle(new Request('test', 'cd:/go/golang/rsc.io/quote'))
    request.fetchResult.copyTo(request)
    expect(request.casedSpec.revision).to.equal('v1.5.3-pre1')
  })

  it('marks the request for skipping when no info is found', async () => {
    const handler = setup()
    handler._getInfo = () => null

    const request = await handler.handle(new Request('test', 'cd:/go/golang/rsc.io/quote/v1.3.0'))

    expect(request.processControl).to.equal('skip')
    expect(request.document).to.be.undefined
    expect(request.casedSpec).to.be.undefined
    expect(request.fetchResult).to.be.undefined
  })

  it('marks the request for skipping when no revision is found', async () => {
    const handler = setup()
    handler._getLatestVersion = () => null

    const request = await handler.handle(new Request('test', 'cd:/go/golang/rsc.io/quote'))

    expect(request.processControl).to.equal('skip')
    expect(request.document).to.be.undefined
    expect(request.casedSpec).to.be.undefined
    expect(request.fetchResult).to.be.undefined
  })

  it('marks the request for skipping when no artifact is found', async () => {
    const handler = setup()
    handler._getArtifact = () => false

    const request = await handler.handle(new Request('test', 'cd:/go/golang/rsc.io/quote/v1.3.0'))

    expect(request.processControl).to.equal('skip')
    expect(request.outcome).to.eq('Missing  ')
    expect(request.document).to.be.undefined
    expect(request.casedSpec).to.be.undefined
    expect(request.fetchResult).to.be.undefined
  })

  it('marks the request for requeuing when pkg.go.dev return 429', async () => {
    const handler = Fetch({
      logger: {
        log: sinon.spy(),
        info: sinon.spy(),
      },
      http: {
        get: sinon.stub().throws(merge(new Error(), {
          response: {
            status: 429
          }
        }))
      }
    })
    const request = await handler.handle(new Request('test', 'cd:/go/golang/rsc.io/quote/v1.3.0'))
    expect(request.processControl).to.equal('requeue')
  })

  it('should not requeue after requeued 5 times', async () => {
    const handler = Fetch({
      logger: {
        log: sinon.spy(),
        info: sinon.spy(),
      },
      http: {
        get: sinon.stub().throws(merge(new Error(), {
          response: {
            status: 429
          }
        }))
      }
    })
    let request = new Request('test', 'cd:/go/golang/rsc.io/quote/v1.3.0')
    request.attemptCount = 5
    request = await handler.handle(request)
    expect(request.processControl).to.be.undefined
  })

  it('should not throw error when pkg.go.dev return 404', async () => {
    const handler = Fetch({
      logger: {
        log: sinon.spy(),
        info: sinon.spy(),
      },
      http: {
        get: sinon.stub().throws(merge(new Error(), {
          response: {
            status: 404
          }
        }))
      }
    })
    const request = await handler.handle(new Request('test', 'cd:/go/golang/rsc.io/quote/v1.3.0'))
    expect(request.fetchResult.document.registryData?.licenses).to.be.undefined
  })

  it('should not pass invalid license if html changed', async () => {
    const info = sinon.spy()
    const handler = Fetch({
      logger: {
        log: sinon.spy(),
        info,
      },
      http: {
        get: sinon.stub().returns({
          status: 200,
          data:
            `<article>
                <section class="License" id="lic-0">
                  <h2 class="go-textTitle">
                    <div id="#lic-0">Apache-2.0</div>
                    <div id="#lic-1">HTML has changed</div>
                  </h2>
                </section>
              </article>`
        })
      }
    })
    const request = await handler.handle(new Request('test', 'cd:/go/golang/rsc.io/quote/v1.3.0'))
    expect(request.fetchResult.document.registryData?.licenses).to.be.undefined
    expect(info.called)
  })
})

function spec(type, provider, namespace, name, revision) {
  return { type, provider, namespace, name, revision }
}

function setup() {
  const options = { logger: { log: sinon.stub() } }
  const handler = Fetch(options)
  return handler
}
