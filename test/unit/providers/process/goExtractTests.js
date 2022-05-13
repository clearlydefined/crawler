const expect = require('chai').expect
const sinon = require('sinon')
const Request = require('../../../../ghcrawler').request
const GoExtract = require('../../../../providers/process/goExtract')

describe('Go processing', () => {
  it('determines whether the request can be handled', async () => {
    const { processor, request } = await setup()
    expect(processor.canHandle(request)).to.be.equal(true)

    const invalidRequest = createInvalidRequest()
    expect(processor.canHandle(invalidRequest)).to.be.equal(false)
  })

  it('determines whether the request is already processing', async () => {
    const { processor, request } = await setup()
    processor.isProcessing = () => true
    processor._createDocument = sinon.stub()

    await processor.handle(request)

    expect(processor._createDocument.callCount).to.be.equal(1)
  })

  it('processes a Go package correctly', async () => {
    const { processor, request } = await setup()
    processor.linkAndQueue = sinon.stub()
    await processor.handle(request)

    expect(processor.linkAndQueueTool.callCount).to.be.equal(3)
    expect(processor.linkAndQueueTool.args.map(call => call[1])).to.have.members([
      'licensee',
      'scancode',
      'reuse'
    ])
  })
})

async function setup() {
  const processor = GoExtract({ logger: {} }, () => { })
  processor.linkAndQueueTool = sinon.stub()
  const request = createRequest()
  const dir = processor.createTempDir(request)
  request.document.location = dir.name
  return { processor, request }
}

function createRequest() {
  const request = new Request('go', 'cd:/go/golang/rsc.io/quote/1.5.2')
  request.document = {
    _metadata: { links: {} },
    sourceInfo: {
      type: 'go',
      provider: 'golang',
      namespace: 'rsc.io',
      name: 'quote',
      revision: '1.5.2'
    }
  }
  request.processMode = 'process'
  return request
}

function createInvalidRequest() {
  const request = new Request('deb', 'cd:/go/golang/rsc.io/quote/1.5.2')
  request.document = {
    _metadata: { links: {} },
    sourceInfo: {
      type: 'deb',
      provider: 'golang',
      namespace: 'rsc.io',
      name: 'quote',
      revision: '1.5.2'
    }
  }
  request.processMode = 'process'
  return request
}
