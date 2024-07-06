// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const axios = require('axios')

function buildRequestOptions(request) {
  let responseType = 'text'
  if (request.json) {
    responseType = 'json'
  } else if (request.encode === null) {
    responseType = 'stream'
  }

  return {
    method: request.method,
    url: request.url,
    responseType,
    headers: request.headers,
    data: request.body
  }
}

async function callFetch(request, axiosInstance = axios) {
  try {
    const options = buildRequestOptions(request)
    const response = await axiosInstance(options)
    if (request.resolveWithFullResponse) return response
    return response.data
  } catch (error) {
    if (error.response && request.resolveWithFullResponse) return error.response
    throw error
  }
}

function withDefaults(opts) {
  const axiosInstance = axios.create(opts)
  return request => callFetch(request, axiosInstance)
}

module.exports = { callFetch, withDefaults }
