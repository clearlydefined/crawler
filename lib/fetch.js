// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const axios = require('axios')
const HttpsProxyAgent = require('https-proxy-agent')

const defaultHeaders = Object.freeze({ 'User-Agent': 'clearlydefined.io crawler (clearlydefined@outlook.com)' })

axios.defaults.headers = defaultHeaders

const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy
const httpsAgent = httpsProxy ? new HttpsProxyAgent(httpsProxy) : undefined

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

  return {
    method: request.method,
    url: request.url || request.uri,
    responseType,
    headers: request.headers,
    data: request.body,
    httpsAgent,
    proxy: false, // to make sure the httpsAgent proxy will be used if set
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
  const axiosInstance = axios.create({
    ...opts,
    httpsAgent,
    proxy: false
  })
  return request => callFetch(request, axiosInstance)
}

module.exports = { callFetch, withDefaults, defaultHeaders }
