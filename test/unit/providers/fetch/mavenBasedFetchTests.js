const { expect } = require('chai')
const MavenBasedFetch = require('../../../../providers/fetch/mavenBasedFetch')
const mockttp = require('mockttp')
const sinon = require('sinon')
const { defaultHeaders } = require('../../../../lib/fetch')
const Request = require('../../../../ghcrawler').request

function checkDefaultHeaders(headers) {
  for (const [key, value] of Object.entries(defaultHeaders)) {
    expect(headers).to.have.property(key.toLowerCase()).that.equals(value)
  }
}

describe('MavenBasedFetch', () => {
  describe('find contained file stat', () => {
    it('file contained in root dir', async () => {
      const destination = 'test/fixtures/package1'
      const file = await MavenBasedFetch._findAnyFileStat(destination)
      expect(file.mtime).to.be.ok
      expect(file.mtime.toISOString().includes('2022-02-24'))
    })
    it('file contained in nested dir', async () => {
      const destination = 'test/fixtures/recursivedir'
      const file = await MavenBasedFetch._findAnyFileStat(destination)
      expect(file.mtime).to.be.ok
      expect(file.mtime.toISOString().includes('2022-02-24'))
    })
  })

  describe('Integration test', function () {
    const path = '/remotecontent?filepath='
    const mockServer = mockttp.getLocal()
    let endpointMock
    let handler
    beforeEach(async () => {
      await mockServer.start()
      handler = new MavenBasedFetch(
        {
          mavencentral: mockServer.urlFor(path)
        },
        { logger: { log: sinon.stub() } }
      )
      endpointMock = await mockServer.forAnyRequest().thenReply(404)
    })
    afterEach(async () => await mockServer.stop())

    it('should handle maven components not found', async () => {
      const request = await handler.handle(
        new Request('test', 'cd:/maven/mavencentral/org.apache.httpcomponents/httpcore/4.')
      )
      expect(request.processControl).to.be.equal('skip')
    })

    it('should check for default header in any request', async () => {
      await handler.handle(new Request('test', 'cd:/maven/mavencentral/org.apache.httpcomponents/httpcore/4.4.16'))
      const requests = await endpointMock.getSeenRequests()
      checkDefaultHeaders(requests[0].headers)
    })
  })
})
