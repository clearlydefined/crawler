const { expect } = require('chai')
const MavenBasedFetch = require('../../../../providers/fetch/mavenBasedFetch')
const mockttp = require('mockttp')
const sinon = require('sinon')
const Request = require('../../../../ghcrawler').request

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

  describe('Integration test for component not found', function () {
    const path = '/remotecontent?filepath='
    const mockServer = mockttp.getLocal()
    beforeEach(async () => await mockServer.start())
    afterEach(async () => await mockServer.stop())

    it('should handle maven components not found', async () => {
      const handler = new MavenBasedFetch(
        {
          mavencentral: mockServer.urlFor(path)
        },
        { logger: { log: sinon.stub() } }
      )
      await mockServer.forAnyRequest().thenReply(404)
      const request = await handler.handle(
        new Request('test', 'cd:/maven/mavencentral/org.apache.httpcomponents/httpcore/4.')
      )
      expect(request.processControl).to.be.equal('skip')
    })
  })
})
