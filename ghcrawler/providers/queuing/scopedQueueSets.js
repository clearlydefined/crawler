// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT
const debug = require('debug')('crawler:scopedQueueSets')
debug.log = console.info.bind(console)

class ScopedQueueSets {
  constructor(globalQueues, localQueues) {
    this._scopedQueues = {
      local: localQueues,
      global: globalQueues
    }
  }

  _getQueuesInScope(scope) {
    return this._scopedQueues[scope || 'global']
  }

  addQueue(queue, location = 'beginning', scope = null) {
    this._getQueuesInScope(scope)?.addQueue(queue, location)
  }

  push(requests, name, scope) {
    return this.getQueue(name, scope).push(requests)
  }

  async repush(original, newRequest) {
    //Always retry on the global queue
    const queue = original._retryQueue ? this.getQueue(original._retryQueue, 'global') : original._originQueue
    if (queue !== original._originQueue) await original._originQueue.done(original)
    return queue.push(newRequest)
  }

  subscribe() {
    return Promise.all(
      Object.values(this._scopedQueues).map(queues => {
        return queues.subscribe()
      })
    )
  }

  unsubscribe() {
    return Promise.all(
      Object.values(this._scopedQueues).map(queues => {
        return queues.unsubscribe()
      })
    )
  }

  pop() {
    return this._scopedQueues.local.pop()
      .then(request => {
        if (request) {
          //mark to retry on the global queues
          request._retryQueue = request._originQueue.getName()
          return request
        }
        return this._scopedQueues.global.pop()
      })
  }

  done(request) {
    const acked = request.acked
    request.acked = true
    return !acked && request._originQueue ? request._originQueue.done(request) : Promise.resolve()
  }

  defer(request) {
    return request._originQueue ? request._originQueue.defer(request) : Promise.resolve()
  }

  abandon(request) {
    const acked = request.acked
    request.acked = true
    return !acked && request._originQueue ? request._originQueue.abandon(request) : Promise.resolve()
  }

  getQueue(name, scope = null) {
    return this._getQueuesInScope(scope)?.getQueue(name)
  }

  publish() {
    const publishToGlobal = async localQueue => {
      const localRequests = []
      const info = await localQueue.getInfo()
      for (let count = info.count; count > 0; count--) {
        localRequests.push(
          localQueue.pop()
            .then(request => request && localQueue.done(request)
              .then(() => this.push(request, localQueue.getName(), 'global'))))
      }
      debug(`publishing ${localRequests.length} to ${localQueue.getName()}`)
      return Promise.all(localRequests)
    }

    return Promise.allSettled(this._scopedQueues.local.queues.map(publishToGlobal))
      .then(results => {
        const found = results.find(result => result.status === 'rejected')
        if (found) throw new Error(found.reason)
      })
  }
}

module.exports = ScopedQueueSets
