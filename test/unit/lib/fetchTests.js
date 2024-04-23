const sinon = require('sinon');
const axios = require('axios');
const { callFetch } = require('../../../lib/fetch');


describe('callFetch', () => {
  let axiosStub;

  beforeEach(() => {
    axiosStub = sinon.stub(axios, 'default');
  });

  afterEach(() => {
    axiosStub.restore();
  });

  it('should make a request with the correct parameters', async () => {
    const request = {
      method: 'GET',
      url: 'http://test.com',
      responseType: 'json',
      headers: { 'Content-Type': 'application/json' },
      body: { key: 'value' },
    };

    const response = { data: 'response' };
    axiosStub.resolves(response);

    const result = await callFetch(request);

    expect(result).toEqual('response');
    expect(axiosStub.calledOnce).toBeTruthy();
    expect(axiosStub.calledWith({
      method: request.method,
      url: request.url,
      responseType: request.responseType,
      headers: request.headers,
      data: request.body,
    })).toBeTruthy();
  });
});