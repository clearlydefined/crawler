// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const auth = require('../middleware/auth')
const express = require('express')
const Request = require('../lib/request')
const wrap = require('../middleware/promiseWrap')

let crawlerService = null
const router = express.Router()

router.post(
  '/:queue?',
  auth.validate,
  wrap(function*(request, response) {
    const result = yield queueRequests(request.body, request.params.queue || 'normal')
    if (!result) {
      return response.sendStatus(404)
    }
    response.sendStatus(201)
  })
)

function queueRequests(requestSpecs, queueName) {
  requestSpecs = Array.isArray(requestSpecs) ? requestSpecs : [requestSpecs]
  const requests = requestSpecs.map(spec => rationalizeRequest(spec))
  return crawlerService.queue(requests, queueName).catch(error => {
    if (error.message && error.message.startsWith('Queue not found')) {
      return null
    }
    throw error
  })
}

function rationalizeRequest(request) {
  if (typeof request === 'string') {
    request = buildRequestFromSpec(request)
  }
  request.policy = request.policy || 'default'
  return Request.adopt(request)
}

function buildRequestFromSpec(spec) {
  let crawlType = null
  let crawlUrl = 'https://api.github.com/'
  if (spec.indexOf('/') > -1) {
    crawlType = 'repo'
    crawlUrl += 'repos/' + spec
  } else {
    crawlType = 'org'
    crawlUrl += 'orgs/' + spec
  }

  return {
    type: crawlType,
    url: crawlUrl,
    policy: 'default'
  }
}

function setup(service) {
  crawlerService = service
  return router
}
module.exports = setup
