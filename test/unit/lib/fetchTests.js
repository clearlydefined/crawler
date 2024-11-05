const { fail } = require('assert')
const { callFetch, withDefaults, defaultHeaders } = require('../../../lib/fetch')
const { expect } = require('chai')
const fs = require('fs')
const mockttp = require('mockttp')

function checkDefaultHeaders(headers) {
  for (const [key, value] of Object.entries(defaultHeaders)) {
    expect(headers).to.have.property(key.toLowerCase()).that.equals(value)
  }
}
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

    it('checks if the default header user-agent and other header is present in crate components', async () => {
      const path = '/crates.io/api/v1/crates/name/1.0.0/download'
      const endpointMock = await mockServer.forGet(path).thenReply(200, 'success')

      await callFetch({
        url: mockServer.urlFor(path),
        method: 'GET',
        json: true,
        encoding: null,
        headers: {
          Accept: 'text/html'
        }
      })
      const requests = await endpointMock.getSeenRequests()
      checkDefaultHeaders(requests[0].headers)
      expect(requests[0].headers).to.include({ accept: 'text/html' })
    })

    it('checks if the default header user-agent is present in crate components', async () => {
      const path = '/crates.io/api/v1/crates/name'
      const endpointMock = await mockServer.forGet(path).thenReply(200, 'success')

      await callFetch({
        url: mockServer.urlFor(path),
        method: 'GET',
        json: true
      })
      const requests = await endpointMock.getSeenRequests()
      checkDefaultHeaders(requests[0].headers)
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
      expect(response.statusCode).to.be.equal(200)
      expect(response.statusMessage).to.be.equal('OK')
    })

    it('should throw error with error code', async () => {
      const path = '/registry.npmjs.com/redis/0.1.'
      await mockServer.forGet(path).thenReply(404)
      try {
        await callFetch({
          url: mockServer.urlFor(path),
          method: 'GET',
          json: 'true',
          resolveWithFullResponse: true
        })
        fail('should have thrown')
      } catch (err) {
        expect(err.statusCode).to.be.equal(404)
      }
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
        encoding: null
      })
      const destination = 'test/fixtures/fetch/temp.json'
      await new Promise(resolve => {
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

      const defaultOptions = { headers: defaultHeaders }
      const requestWithDefaults = withDefaults(defaultOptions)
      await requestWithDefaults({ url })
      await requestWithDefaults({ url })

      const requests = await endpointMock.getSeenRequests()
      expect(requests.length).to.equal(2)
      expect(requests[0].url).to.equal(url)
      checkDefaultHeaders(requests[0].headers)
      expect(requests[1].url).to.equal(url)
      checkDefaultHeaders(requests[1].headers)
    })

    it('checks if the response is text with uri option in GET request', async () => {
      const path = '/proxy.golang.org/rsc.io/quote/@v/v1.3.0.mod'
      await mockServer.forGet(path).thenReply(200, 'done')

      const response = await callFetch({
        uri: mockServer.urlFor(path),
        method: 'GET'
      })
      expect(response).to.be.equal('done')
    })

    it('should POST with JSON', async function () {
      const path = '/webhook'
      const endpointMock = await mockServer.forPost(path).thenReply(200, 'done')

      const response = await callFetch({
        method: 'POST',
        uri: mockServer.urlFor(path),
        json: true,
        body: { test: 'test' },
        headers: { 'x-crawler': 'secret' },
        resolveWithFullResponse: true
      })
      expect(response.statusCode).to.be.equal(200)
      const requests = await endpointMock.getSeenRequests()
      expect(requests.length).to.equal(1)
      const json = await requests[0].body.getJson()
      expect(json).to.deep.equal({ test: 'test' })
      expect(requests[0].headers).to.include({ 'x-crawler': 'secret' })
      //Check for the default header value
      checkDefaultHeaders(requests[0].headers)
    })

    describe('test simple', () => {
      it('should handle 300 when simple is true by default', async () => {
        const path = '/registry.npmjs.com/redis/0.1.0'
        await mockServer.forGet(path).thenReply(300, 'test')

        try {
          await callFetch({ url: mockServer.urlFor(path) })
          fail('should have thrown')
        } catch (err) {
          expect(err.statusCode).to.be.equal(300)
        }
      })

      it('should handle 300 with simple === false', async () => {
        const path = '/registry.npmjs.com/redis/0.1.0'
        await mockServer.forGet(path).thenReply(300, 'test')

        const response = await callFetch({
          url: mockServer.urlFor(path),
          simple: false
        })
        expect(response).to.be.equal('test')
      })

      it('should return status 300 with simple === false', async () => {
        const path = '/registry.npmjs.com/redis/0.1.0'
        await mockServer.forGet(path).thenReply(300, 'test')

        const response = await callFetch({
          url: mockServer.urlFor(path),
          simple: false,
          resolveWithFullResponse: true
        })
        expect(response.statusCode).to.be.equal(300)
        expect(response.statusMessage).to.be.equal('Multiple Choices')
      })
    })
  })

  describe('test crate download', () => {
    // This test case downloads a crate package
    // This URL would send a JSON response if the header is not provided as a part of request.
    it('should follow redirect and download the package when responseType is stream', async () => {
      const response = await callFetch({
        url: 'https://crates.io/api/v1/crates/bitflags/1.0.4/download',
        method: 'GET',
        encoding: null,
        headers: {
          Accept: 'text/html'
        }
      })
      // Validating the length of the content in order to verify the response is a crate package.
      // JSON response would not return this header in response resulting in failing this test case.
      expect(response.headers['content-length']).to.be.equal('15282')
      return new Promise((resolve, reject) => {
        response.on('data', () => {})
        response.on('end', () => resolve(true))
        response.on('error', reject)
      })
    })

    it('should download the package when responseType is stream', async () => {
      const response = await callFetch({
        url: 'https://static.crates.io/crates/bitflags/bitflags-1.0.4.crate',
        method: 'GET',
        encoding: null
      })
      // Validating the length of the content inorder to verify the response is a crate package.
      expect(response.headers['content-length']).to.be.equal('15282')
      return new Promise((resolve, reject) => {
        response.on('data', () => {})
        response.on('end', () => resolve(true))
        response.on('error', reject)
      })
    })
  })
})
