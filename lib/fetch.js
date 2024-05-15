// (c) Copyright 2024, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const axios = require('axios')

async function callFetch(request) {
  try {
    const response = await axios({
      method: request.method,
      url: request.url,
      responseType: request.responseType,
      headers: request.headers,
      data: request.body,
    })
    if (request.resolveWithFullResponse) return response
    return response.data
  } catch (error) {
    return error.response
  }
}
module.exports = { callFetch }
