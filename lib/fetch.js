// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const axios = require('axios')
const { default: axiosRetry } = require('axios-retry')

const defaultHeaders = Object.freeze({ 'User-Agent': 'clearlydefined.io crawler (clearlydefined@outlook.com)' })
const defaultMaximumAttempts = 3

axios.defaults.headers.common['User-Agent'] = defaultHeaders['User-Agent']

// Create a shared axios instance with retry configured for the default case
const defaultRetryInstance = axios.create()
axiosRetry(defaultRetryInstance, {
  retries: defaultMaximumAttempts - 1,
  retryDelay: (retryCount, error) => {
    return axiosRetry.exponentialDelay(retryCount, error, 100)
  }
})

/**
 * @param {{ method?: string, url?: string, uri?: string, json?: boolean, encoding?: null | string, simple?: boolean, headers?: any, body?: any }} request
 * @returns {any}
 */
function buildRequestOptions(request) {
  /** @type {import('axios').ResponseType} */
  let responseType = 'text'
  if (request.json) {
    responseType = 'json'
  } else if (request.encoding === null) {
    responseType = 'stream'
  }
  /** @type {any} */
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

/**
 * @param {{ method?: string, url?: string, uri?: string, json?: boolean, encoding?: null | string, simple?: boolean, headers?: any, body?: any, resolveWithFullResponse?: boolean }} request
 * @param {any} [axiosInstance]
 */
async function callFetch(request, axiosInstance = axios) {
  try {
    const options = buildRequestOptions(request)
    const response = await axiosInstance(options)
    if (!request.resolveWithFullResponse) return response.data
    /** @type {any} */
    const res = response
    res.statusCode = response.status
    res.statusMessage = response.statusText
    return response
  } catch (error) {
    /** @type {any} */
    const err = error
    err.statusCode = err.response?.status
    throw error
  }
}

/** @param {any} opts */
function withDefaults(opts) {
  const axiosInstance = axios.create(opts)
  return /** @param {any} request */ request => callFetch(request, axiosInstance)
}

/** @param {string | { url: string, [key: string]: any }} opt */
async function getStream(opt) {
  if (typeof opt === 'string') {
    opt = { url: opt }
  }
  /** @type {any} */
  const request = {
    ...opt,
    encoding: null,
    method: 'GET',
    resolveWithFullResponse: true
  }
  return await callFetch(request)
}

/**
 * @param {string} url
 * @param {any} [options]
 * @param {any} [retryOptions]
 */
async function callFetchWithRetry(url, options = {}, retryOptions = {}) {
  const { maxAttempts = defaultMaximumAttempts, ...otherRetryOpts } = retryOptions

  // Use shared instance if using default settings, otherwise create a new one
  let axiosInstance = defaultRetryInstance
  const hasCustomRetryOptions = maxAttempts !== defaultMaximumAttempts || Object.keys(otherRetryOpts).length > 0

  if (hasCustomRetryOptions) {
    axiosInstance = axios.create()
    axiosRetry(axiosInstance, {
      retries: maxAttempts - 1,
      retryDelay: (retryCount, error) => {
        return axiosRetry.exponentialDelay(retryCount, error, 100)
      },
      ...otherRetryOpts
    })
  }

  const resolveWithFullResponse = options.resolveWithFullResponse ?? true
  const request = { url, ...options, resolveWithFullResponse }
  try {
    const response = await callFetch(request, axiosInstance)
    if (!resolveWithFullResponse) return response
    return {
      statusCode: response.status,
      headers: response.headers,
      body: response.data,
      request: response.request
    }
  } catch (err) {
    if (/** @type {any} */ (err).response && resolveWithFullResponse) {
      return {
        statusCode: /** @type {any} */ (err).response.status,
        headers: /** @type {any} */ (err).response.headers,
        body: /** @type {any} */ (err).response.data,
        request: /** @type {any} */ (err).response.request
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
