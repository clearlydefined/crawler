const expect = require('chai').expect
const sinon = require('sinon')
const Request = require('../../../../ghcrawler').request
const SourceProcessor = require('../../../../providers/process/source').processor

describe('Source processing', () => {
  let processor

  beforeEach(() => {
    processor = SourceProcessor({})
  })

  it('process source package correctly', async () => {
    processor.linkAndQueueTool = sinon.stub()

    const request = mockRequest('cd:/sourcearchive/mavengoogle/android.arch.lifecycle/common/1.0.1')
    processor.handle(request)

    expect(processor.linkAndQueueTool.callCount).to.be.equal(4)
    expect(processor.linkAndQueueTool.args.map(call => call[1])).to.have.members([
      'clearlydefined',
      'licensee',
      'scancode',
      'reuse'
    ])
  })
})

function mockRequest(url) {
  const request = new Request('source', url)
  request.document = {
    _metadata: { links: {} }
  }
  return request
}