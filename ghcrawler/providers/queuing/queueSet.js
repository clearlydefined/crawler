// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

class QueueSet {
  constructor(queues, options) {
    this.queues = queues
    this._configureQueues()
    this.options = options
    this.options._config.on('changed', this._reconfigure.bind(this))
    this.startMap = this._createStartMap(this.options.weights)
    this.popCount = 0
  }

  _configureQueues() {
    this.queueTable = this.queues.reduce((table, queue) => {
      table[queue.getName()] = queue
      return table
    }, {})
    if (this.queues.length > Object.getOwnPropertyNames(this.queueTable).length) {
      throw new Error('Duplicate queue names')
    }
  }

  addQueue(queue, location = 'beginning') {
    if (location === 'beginning') this.queues.unshift(queue)
    else this.queues.push(queue)
    this._configureQueues()
  }

  _reconfigure(current, changes) {
    if (changes.some(patch => patch.path.includes('/weights'))) {
      this._startMap = this._createStartMap(this.options.weights)
    }
    return Promise.resolve()
  }

  push(requests, name) {
    return this.getQueue(name).push(requests)
  }

  subscribe() {
    return Promise.all(
      this.queues.map(queue => {
        return queue.subscribe()
      })
    )
  }

  unsubscribe() {
    return Promise.all(
      this.queues.map(queue => {
        return queue.unsubscribe()
      })
    )
  }

  pop(startMap = this.startMap) {
    let result = Promise.resolve()
    const start = startMap[Math.floor(Math.random() * startMap.length)]
    for (let i = 0; i < this.queues.length; i++) {
      const queue = this.queues[(start + i) % this.queues.length]
      result = result.then(this._pop.bind(this, queue))
    }
    return result
  }

  async _pop(queue, request = null) {
    const result = request || await queue.pop()
    if (result && !result._originQueue) {
      result._originQueue = queue
    }
    return result
  }

  getQueue(name) {
    const result = this.queueTable[name]
    if (!result) {
      throw new Error(`Queue not found: ${name}`)
    }
    return result
  }

  _createStartMap(weights) {
    // Create a simple table of which queue to pop based on the weights supplied.  For each queue,
    // look up its weight and add that many entries in the map.  If no weight is included, assume 1.
    weights = weights || {}
    const result = []
    for (let i = 0; i < this.queues.length; i++) {
      const count = weights[this.queues[i].getName()] || 1
      for (let j = 0; j < count; j++) {
        result.push(i)
      }
    }
    return result
  }
}

module.exports = QueueSet
