const { get } = require('lodash')

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
          //retry on the global queue with the same name
          request._retryQueue = get(request._originQueue, 'queue.name')
          return request
        }
        return this._scopedQueues.global.pop()
      })
  }

  repush(original, newRequest) {
    const queue = original._retryQueue ? this.getQueue(original._retryQueue) : original._originQueue
    return queue.push(newRequest)
  }

  done(request) {
    const acked = request.acked
    request.acked = true
    return !acked && request._originQueue ? request._originQueue.done(request) : Promise.resolve()
  }

  defer(request) {
    //TODO: request.markDefer() not used?
    return request._originQueue ? request._originQueue.defer(request) : Promise.resolve()
  }

  abandon(request) {
    const acked = request.acked
    request.acked = true
    return !acked && request._originQueue ? request._originQueue.abandon(request) : Promise.resolve()
  }

  //TODO: check crawlerService, it is operating on the queue (flush, getInfo, getRequests)
  //should avoid that exposing the queues.
  //TODO: make this private
  getQueue(name, scope = null) {
    return this._getQueuesInScope(scope)?.getQueue(name)
  }

}

module.exports = ScopedQueueSets
