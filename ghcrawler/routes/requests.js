// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const asyncMiddleware = require('../middleware/asyncMiddleware')
const auth = require('../middleware/auth')
const express = require('express')
const Request = require('../lib/request')

let crawlerService = null
const router = express.Router()

router.post(
  '/:queue?',
  auth.validate,
  asyncMiddleware(async (request, response) => {
    const result = await queueRequests(request.body, request.params.queue || 'normal')
    if (!result) {
      return response.sendStatus(404)
    }
    response.sendStatus(201)
  })
)

async function queueRequests(requestSpecs, queueName) {
  requestSpecs = Array.isArray(requestSpecs) ? requestSpecs : [requestSpecs]
  const requests = requestSpecs.map(spec => rationalizeRequest(spec))
  try {
    return crawlerService.queue(requests, queueName)
  } catch (error) {
    if (error.message && error.message.startsWith('Queue not found')) {
      return null
    }
    throw error
  }
}

// request example: { "type": "...", "url": "cd:/...", <other optional objects> }
function rationalizeRequest(request) {
  request.policy = request.policy || 'default'
  return Request.adopt(request)
}

function setup(service) {
  crawlerService = service
  return router
}
module.exports = setup
