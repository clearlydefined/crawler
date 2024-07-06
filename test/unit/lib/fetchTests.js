const { callFetch, withDefaults } = require('../../../lib/fetch')
const { expect } = require('chai')
const fs = require('fs')
const mockttp = require('mockttp')

describe('CallFetch', () => {
  describe('with mock server', () => {
    const mockServer = mockttp.getLocal()
    beforeEach(async () => await mockServer.start())
    afterEach(async () => await mockServer.stop())

    it('checks if the response is JSON while sending GET request', async () => {
      const path = '/registry.npmjs.com/redis/0.1.0'
      const expected = fs.readFileSync('test/fixtures/fetch/redis-0.1.0.json')
      await mockServer.forGet(path).thenReply(200, expected)

      const response = await callFetch({
        url: mockServer.urlFor(path),
        method: 'GET',
        json: true
      })
      expect(response).to.be.deep.equal(JSON.parse(expected))
    })

    it('checks if the full response is fetched', async () => {
      const path = '/registry.npmjs.com/redis/0.1.0'
      const expected = fs.readFileSync('test/fixtures/fetch/redis-0.1.0.json')
      await mockServer.forGet(path).thenReply(200, expected)

      const response = await callFetch({
        url: mockServer.urlFor(path),
        method: 'GET',
        resolveWithFullResponse: true
      })
      expect(response.status).to.be.equal(200)
      expect(response.statusText).to.be.equal('OK')
    })

    it('checks if the full response is fetched with error code', async () => {
      const path = '/registry.npmjs.com/redis/0.1.'
      await mockServer.forGet(path).thenReply(404)

      const response = await callFetch({
        url: mockServer.urlFor(path),
        method: 'GET',
        json: 'true',
        resolveWithFullResponse: true
      })
      expect(response.status).to.be.equal(404)
      expect(response.statusText).to.be.equal('Not Found')
    })

    it('checks if the response is text while sending GET request', async () => {
      const path = '/proxy.golang.org/rsc.io/quote/@v/v1.3.0.mod'
      await mockServer.forGet(path).thenReply(200, 'module "rsc.io/quote"\n')

      const response = await callFetch({
        url: mockServer.urlFor(path),
        method: 'GET'
      })
      expect(response).to.be.equal('module "rsc.io/quote"\n')
    })

    it('should download stream successfully with GET request', async () => {
      const expected = JSON.parse(fs.readFileSync('test/fixtures/fetch/redis-0.1.0.json'))
      const path = '/registry.npmjs.com/redis/0.1.0'
      await mockServer.forGet(path).thenStream(200, fs.createReadStream('test/fixtures/fetch/redis-0.1.0.json'))

      const response = await callFetch({
        url: mockServer.urlFor(path),
        encode: null
      })
      const destination = 'test/fixtures/fetch/temp.json'
      await new Promise((resolve) => {
        response.pipe(fs.createWriteStream(destination).on('finish', () => resolve(true)))
      })
      const downloaded = JSON.parse(fs.readFileSync(destination))
      expect(downloaded).to.be.deep.equal(expected)
      fs.unlinkSync(destination)
    })

    it('should apply default headers ', async () => {
      const path = '/registry.npmjs.com/redis/0.1.0'
      const url = mockServer.urlFor(path)
      const endpointMock = await mockServer.forGet(path).thenReply(200)

      const defaultOptions = { headers: { 'user-agent': 'clearlydefined.io crawler (clearlydefined@outlook.com)' } }
      const requestWithDefaults = withDefaults(defaultOptions)
      await requestWithDefaults({ url })
      await requestWithDefaults({ url })

      const requests = await endpointMock.getSeenRequests()
      expect(requests.length).to.equal(2)
      expect(requests[0].url).to.equal(url)
      expect(requests[0].headers).to.include(defaultOptions.headers)
      expect(requests[1].url).to.equal(url)
      expect(requests[1].headers).to.include(defaultOptions.headers)
    })
  })

  describe('test crate download', () => {
    // This test case downloads a crate package
    // This URL would send a JSON response if the header is not provided as a part of request.
    it('should follow redirect and download the package when responseType is stream', async () => {
      const response = await callFetch({
        url: 'https://crates.io/api/v1/crates/bitflags/1.0.4/download',
        method: 'GET',
        encode: null,
        headers: {
          Accept: 'text/html'
        }
      })
      // Validating the length of the content in order to verify the response is a crate package.
      // JSON response would not return this header in response resulting in failing this test case.
      expect(response.headers['content-length']).to.be.equal('15282')
    })

    it('should download the package when responseType is stream', async () => {
      const response = await callFetch({
        url: 'https://static.crates.io/crates/bitflags/bitflags-1.0.4.crate',
        method: 'GET',
        encode: null
      })
      // Validating the length of the content inorder to verify the response is a crate package.
      expect(response.headers['content-length']).to.be.equal('15282')
    })
  })
})
