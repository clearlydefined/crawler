const { expect } = require('chai')
const sourceArchiveExtract = require('../../../../providers/process/sourcearchiveExtract')
const Request = require('../../../../ghcrawler').request

const pomsArray = [{ pom1: 'pom1' }, { pom2: 'pom2' }]
const summaryObj = { version: '8.1.0' }

describe('SourceArchiveExtract Tests', () => {
  it('checks the summary and poms section in clearlydefined result', async () => {
    const { processor, request } = await setup()
    await processor.handle(request)
    expect(request.document.manifest.summary).to.be.deep.equal(summaryObj)
    expect(request.document.manifest.poms).to.be.deep.equal(pomsArray)
  })
})

async function setup() {
  const processor = sourceArchiveExtract({ logger: {} })
  const request = createRequest()
  const dir = processor.createTempDir(request)
  request.document.location = dir.name
  request.document.summary = summaryObj
  request.document.poms = pomsArray
  return { processor, request }
}

function createRequest() {
  const request = new Request('source', 'cd:/sourcearchive/mavencentral/org.osgi/osgi.annotation/8.1.0')
  request.document = { _metadata: { links: {} }, registryData: { manifest: {} } }
  return request
}
