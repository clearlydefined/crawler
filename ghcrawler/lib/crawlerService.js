// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const Request = require('./request')

class CrawlerService {
  constructor(crawler, options) {
    this.crawler = crawler
    this.options = options
    this.loops = []
  }

  async ensureInitialized() {
    // deferred initialization of the options and crawler.  When they are available, swap them in and listen for changes
    if (typeof this.crawler.then !== 'function') {
      return
    }
    return this.crawler
      .then(([crawler, options]) => {
        this.options = options
        this.options.crawler._config.on('changed', this._reconfigure.bind(this))
        this.crawler = crawler
      })
      .then(() => {
        return this.crawler.initialize ? this.crawler.initialize() : null
      })
  }

  run() {
    return this.ensureInitialized().then(() => {
      return this.ensureLoops()
    })
  }

  _loopComplete(loop) {
    console.log(`Done loop ${loop.options.name}`)
  }

  async ensureLoops() {
    this.loops = this.loops.filter(loop => loop.running())
    const running = this.status()
    const delta = this.options.crawler.count - running
    if (delta < 0) {
      for (let i = 0; i < Math.abs(delta); i++) {
        const loop = this.loops.shift()
        loop.stop()
      }
    } else {
      for (let i = 0; i < delta; i++) {
        const loop = new CrawlerLoop(this.crawler, i.toString())
        loop.run().finally(this._loopComplete.bind(this, loop))
        this.loops.push(loop)
      }
    }
  }

  status() {
    return this.loops.reduce((running, loop) => {
      return running + (loop.running ? 1 : 0)
    }, 0)
  }

  stop() {
    return this.ensureLoops()
  }

  queues() {
    return this.crawler.queues
  }

  queue(requests, name) {
    return this.crawler.queue(requests, name)
  }

  async flushQueue(name) {
    const queue = this.crawler.queues.getQueue(name)
    if (!queue) {
      return null
    }
    return queue.flush()
  }

  getQueueInfo(name) {
    const queue = this.crawler.queues.getQueue(name)
    if (!queue) {
      return Promise.reject(`No queue found: ${name}`)
    }
    return queue.getInfo()
  }

  async getRequests(name, count, remove = false) {
    const queue = this.crawler.queues.getQueue(name)
    if (!queue) {
      return null
    }

    const result = []
    for (let i = 0; i < count; i++) {
      result.push(queue.pop())
    }
    return Promise.all(result).then(requests => {
      const filtered = requests.filter(request => request)
      return Promise.all(filtered.map(request => (remove ? queue.done(request) : queue.abandon(request)))).then(
        filtered
      )
    })
  }

  listDeadletters() {
    return this.crawler.deadletters.list('deadletter')
  }

  getDeadletter(urn) {
    return this.crawler.deadletters.get('deadletter', urn)
  }

  deleteDeadletter(urn) {
    return this.crawler.deadletters.delete('deadletter', urn)
  }

  requeueDeadletter(url, queue) {
    const self = this
    return this.getDeadletter(url)
      .then(document => {
        const request = Request.adopt(document).createRequeuable()
        request.attemptCount = 0
        return self.crawler.queues.push([request], queue)
      })
      .then(() => {
        return self.deleteDeadletter(url)
      })
  }

  getDeadletterCount() {
    return this.crawler.deadletters.count('deadletter')
  }

  _reconfigure(current, changes) {
    // if the loop count changed, make it so
    if (changes.some(patch => patch.path === '/count')) {
      return this.options.crawler.count.value > 0 ? this.run() : this.stop()
    }
    return null
  }
}

class CrawlerLoop {
  constructor(crawler, name) {
    this.crawler = crawler
    this.options = { name: name, delay: 0 }
    this.done = null
    this.state = null
  }

  running() {
    return this.state === 'running'
  }

  run() {
    if (this.state) {
      throw new Error(`Loop ${this.options.name} can only be run once`)
    }
    this.state = 'running'
    // Create callback that when run, resolves a promise and completes this loop
    const donePromise = new Promise(resolve => {
      this.done = value => resolve(value)
      this.options.done = this.done
    })
    donePromise.finally(() => {
      this.state = 'stopped'
    })

    // Kick off the loop and don't worry about the return value.
    // donePromise will be resolved when the loop is complete.
    this.crawler.run(this.options)
    return donePromise
  }

  stop() {
    if (this.state === 'stopped' || this.state === 'stopping') {
      return
    }
    this.state = 'stopping'
    // set delay to tell the loop to stop next time around
    // TODO consider explicitly waking sleeping loops but they will check whether they
    // should keep running when they wake up.
    this.options.delay = -1
  }
}

module.exports = CrawlerService
