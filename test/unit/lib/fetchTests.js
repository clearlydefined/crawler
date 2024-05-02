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

  //This test case downloads a crate package
  //This URL would send a JSON response if the header is not provided as a part of request.
  it('should follow redirect and download the package when responseType is stream', async () => {
    const response = await callFetch({
      url: 'https://crates.io/api/v1/crates/bitflags/1.0.4/download',
      method: 'GET',
      responseType: 'stream',
      headers: {
        'Accept': 'text/html'
      }
    })
    //Validating the length of the content inorder to verify the response is a crate package.
    // JSON response would not return this header in response resulting in failing this test case.
    expect(response.headers['content-length']).to.be.equal('15282')
  })

  it('should follow redirect and download the package when responseType is stream', async () => {
    const response = await callFetch({
      url: 'https://static.crates.io/crates/bitflags/bitflags-1.0.4.crate',
      method: 'GET',
      responseType: 'stream',
    })
    //Validating the length of the content inorder to verify the response is a crate package.
    expect(response.headers['content-length']).to.be.equal('15282')
  })
})