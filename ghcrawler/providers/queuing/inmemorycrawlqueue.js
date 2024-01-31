// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const extend = require('extend')
const Request = require('../../lib/request')

class InMemoryCrawlQueue {
  constructor(name, options) {
    this.name = name
    this.queue = []
    this.options = options
    this.logger = options.logger
  }

  getName() {
    return this.name
  }

  async push(requests) {
    requests = Array.isArray(requests) ? requests : [requests]
    requests = requests.map(request => extend(true, {}, request))
    this.queue = this.queue.concat(requests)
  }

  async subscribe() {
    return
  }

  async unsubscribe() {
    return
  }

  async pop() {
    const result = this.queue.shift()
    if (!result) {
      return
    }

    return Request.adopt(result)
  }

  async done() {
    return
  }

  // We popped but cannot process right now (e.g., no rate limit).  Stash it away and allow it to be popped later.
  async defer(request) {
    // TODO likely need to do more here.  see the amqp10 code
    this.queue.push(request)
  }

  async abandon(request) {
    this.queue.unshift(request)
  }

  async flush() {
    this.queue = []
  }

  async getInfo() {
    return {
      count: this.queue.length,
      metricsName: this.name
    }
  }
}
module.exports = InMemoryCrawlQueue
