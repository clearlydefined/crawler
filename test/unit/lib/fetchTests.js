const { callFetch } = require("../../../lib/fetch");
const { expect } = require("chai");
const fs = require('fs')
describe('CallFetch', () => {

  it('checks if the response is JSON while sending GET request', async () => {
    const response = await callFetch({
      url: 'https://registry.npmjs.com/redis/0.1.0',
      method: 'GET',
      responseType: 'json'
    })
    expect(response).to.be.deep.equal(JSON.parse(fs.readFileSync('test/fixtures/fetch/redis-0.1.0.json')))
  })

  it('checks if the response is text while sending GET request', async () => {
    const response = await callFetch({
      url: 'https://proxy.golang.org/rsc.io/quote/@v/v1.3.0.mod',
      method: 'GET',
      responseType: 'text'
    })
    expect(response).to.be.equal('module "rsc.io/quote"\n')
  })



  it('checks if the package is downloaded when responseType is stream', async () => {
    const response = await callFetch({
      url: 'https://crates.io/api/v1/crates/bitflags/1.0.4/download',
      method: 'GET',
      responseType: 'stream',
      headers: {
        'Accept': 'text/html'
      }
    })
    expect(response.headers['content-length']).to.be.equal('15282')
  })

})