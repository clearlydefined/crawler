// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const axios = require('axios')

const defaultHeaders = Object.freeze({ 'User-Agent': 'clearlydefined.io crawler (clearlydefined@outlook.com)' })

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

module.exports = { callFetch, withDefaults, defaultHeaders, getStream }
