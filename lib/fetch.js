// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const axios = require('axios')
const axiosRetry = require('axios-retry')

const defaultHeaders = Object.freeze({ 'User-Agent': 'clearlydefined.io crawler (clearlydefined@outlook.com)' })
const maximumAttempts = 3

axios.defaults.headers = defaultHeaders

function buildRequestOptions(request) {
  let responseType = 'text'
  if (request.json) {
    responseType = 'json'
  } else if (request.encoding === null) {
    responseType = 'stream'
  }
  const validateOptions = {}
  if (request.simple === false) {
    validateOptions.validateStatus = () => true
  }
  if (request.gzip) {
    if (!request.headers) request.headers = {}
    request.headers['Accept-Encoding'] = 'gzip'
  }
  return {
    method: request.method,
    url: request.url || request.uri,
    responseType,
    headers: request.headers,
    data: request.body,
    ...validateOptions
  }
}

async function callFetch(request, axiosInstance = axios) {
  try {
    const options = buildRequestOptions(request)
    const response = await axiosInstance(options)
    if (!request.resolveWithFullResponse) return response.data
    response.statusCode = response.status
    response.statusMessage = response.statusText
    return response
  } catch (error) {
    error.statusCode = error.response?.status
    throw error
  }
}

function withDefaults(opts) {
  const axiosInstance = axios.create(opts)
  return request => callFetch(request, axiosInstance)
}

async function getStream(opt) {
  if (typeof opt === 'string') {
    opt = { url: opt }
  }
  const request = {
    ...opt,
    encoding: null,
    method: 'GET',
    headers: { ...defaultHeaders, ...(opt.headers || {}) }
  }
  return await callFetch(request)
}

async function callFetchWithRetry(url, options = {}, retryOptions = {}) {
  const { maxAttempts = maximumAttempts, ...otherRetryOpts } = retryOptions
  const axiosInstance = axios.create()
  axiosRetry(axiosInstance, { retries: maxAttempts, retryDelay: axiosRetry.exponentialDelay, ...otherRetryOpts })
  options.resolveWithFullResponse ??= true
  const request = { url, ...options }
  try {
    const response = await callFetch(request, axiosInstance)
    if (!options.resolveWithFullResponse) return response
    return {
      statusCode: response.status,
      headers: response.headers,
      body: response.data,
      request: response.request
    }
  } catch (err) {
    if (err.response) {
      return {
        statusCode: err.response.status,
        headers: err.response.headers,
        body: err.response.data,
        request: err.response.request
      }
    }
    throw err
  }
}

module.exports = {
  callFetch,
  callFetchWithRetry,
  withDefaults,
  defaultHeaders,
  getStream
}
