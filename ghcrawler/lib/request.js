// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const Policy = require('./traversalPolicy')
const _ = require('lodash')

/**
 * Requests describe a resource to capture and process as well as the context for that processing.
 */
class Request {
  /**
   * @param {string} type
   * @param {string} url
   * @param {Record<string, any> | null} [context]
   */
  constructor(type, url, context = null) {
    this.type = type
    this.url = url
    /** @type {Record<string, any>} */
    this.context = context || {}
    /** @type {import('./traversalPolicy') | string} */
    this.policy = Policy.default(type)
    /** @type {Record<string, unknown> | undefined} */
    this.meta = undefined
    /** @type {{ id?: string | number, _metadata: any, [key: string]: any } | undefined} */
    this.document = undefined
    /** @type {any} */
    this.payload = undefined
    /** @type {{ queue: Function, storeDeadletter: Function, queues: { defer: Function }, logger: { log: Function } } | undefined} */
    this.crawler = undefined
    /** @type {number | undefined} */
    this.start = undefined
    /** @type {Promise<void>[] | undefined} */
    this.promises = undefined
    /** @type {(() => void)[] | undefined} */
    this.cleanups = undefined
    /** @type {boolean | undefined} */
    this.save = undefined
    /** @type {string | undefined} */
    this.processControl = undefined
    /** @type {string | undefined} */
    this.outcome = undefined
    /** @type {string | undefined} */
    this.message = undefined
    /** @type {string | undefined} */
    this.contentOrigin = undefined
    /** @type {number | undefined} */
    this.nextRequestTime = undefined
    /** @type {number | undefined} */
    this.attemptCount = undefined
    /** @type {any} */
    this._originQueue = undefined
    /** @type {import('../../lib/entitySpec') | undefined} */
    this.casedSpec = undefined
  }

  /** @param {Record<string, any>} object */
  static adopt(object) {
    if (object.__proto__ !== Request.prototype) {
      object.__proto__ = Request.prototype
    }
    if (object.policy) {
      object.policy = Request._getResolvedPolicy(object)
      Policy.adopt(object.policy)
    } else {
      Policy.default(object.type)
    }
    return object
  }

  /** @param {any} request */
  static _getResolvedPolicy(request) {
    let policyOrSpec = request.policy
    if (typeof policyOrSpec !== 'string') {
      return policyOrSpec
    }
    policyOrSpec = policyOrSpec.includes(':') ? policyOrSpec : `${policyOrSpec}:${request.type}`
    return Policy.getPolicy(policyOrSpec)
  }

  /** @param {{ queue: Function, storeDeadletter: Function, queues: { defer: Function }, logger: { log: Function } }} crawler */
  open(crawler) {
    this.crawler = crawler
    this.start = Date.now()
    this.context = this.context || {}
    this._addHistory()
    const root = this.context.history.length <= 1 ? 'self' : this.context.history[0]
    this.addMeta({ root: root })
    this._resolvePolicy()
    return this
  }

  /** @returns {void} */
  _resolvePolicy() {
    if (!this.policy) {
      this.markDead('Bogus', 'No policy')
      return
    }
    if (typeof this.policy === 'string') {
      // if the policy spec does not include a map, default to using the type of this request as the map name
      const spec = this.policy.includes(':') ? this.policy : `${this.policy}:${this.type}`
      const policy = Policy.getPolicy(spec)
      if (!policy) {
        this.markDead('Bogus', 'Unable to resolve policy')
        return
      }
      this.policy = policy
    }
  }

  /** @param {string | null} [message] */
  _addHistory(message = null) {
    this.context.history = this.context.history || []
    this.context.history.push((message || this).toString())
  }

  /** @param {{ toString(): string }} request */
  hasSeen(request) {
    const history = this.context.history || []
    return history.includes(request.toString())
  }

  getTrackedPromises() {
    return this.promises || []
  }

  getTrackedCleanups() {
    return this.cleanups || []
  }

  /** @param {Promise<void> | Promise<void>[] | null} promises */
  track(promises) {
    if (!promises) {
      return this
    }
    this.promises = this.promises || []
    if (Array.isArray(promises)) {
      Array.prototype.push.apply(this.promises, promises)
    } else {
      this.promises.push(promises)
    }
    return this
  }

  /** @param {(() => void) | (() => void)[] | null} cleanups */
  trackCleanup(cleanups) {
    if (!cleanups) {
      return this
    }
    this.cleanups = this.cleanups || []
    if (Array.isArray(cleanups)) {
      Array.prototype.push.apply(this.cleanups, cleanups)
    } else {
      this.cleanups.push(cleanups)
    }
    return this
  }

  /** @param {(() => void) | (() => void)[] | null} cleanups */
  removeCleanup(cleanups) {
    if (!cleanups || !this.cleanups) {
      return this
    }
    const toRemove = Array.isArray(cleanups) ? cleanups : [cleanups]
    this.cleanups = this.cleanups.filter(/** @param {any} item */ item => !toRemove.includes(item))
    return this
  }

  /** @param {Record<string, unknown>} data */
  addMeta(data) {
    this.meta = Object.assign({}, this.meta, data)
    return this
  }

  /** @param {string | null} [id] */
  addRootSelfLink(id = null) {
    this.linkResource('self', this.getRootQualifier(id))
  }

  /** @param {string} [key] */
  addSelfLink(key = 'id') {
    this.linkResource('self', this.getChildQualifier(key))
  }

  /** @param {string | null} [id] */
  getRootQualifier(id = null) {
    return `urn:${this.type}:${this.document.id}${id ? `:${id}` : ''}`
  }

  /** @param {string} [key] */
  getChildQualifier(key = 'id') {
    let qualifier = this.context.qualifier
    if (!qualifier || typeof qualifier !== 'string') {
      throw new Error('Need something on which to base the self link URN')
    }
    qualifier = qualifier.endsWith(':') ? qualifier : `${qualifier}:`
    return `${qualifier}${this.type}:${this.document[key]}`
  }
  // TODO -- consider moving to GitHub-specific crawler

  /**
   * @param {string} name
   * @param {string | string[]} urn
   */
  linkResource(name, urn) {
    const links = this.document._metadata.links
    const key = Array.isArray(urn) ? 'hrefs' : 'href'
    links[name] = {}
    links[name][key] = urn
    links[name].type = 'resource'
  }

  /** @param {string} href */
  linkSiblings(href) {
    const links = this.document._metadata.links
    links.siblings = { href: href, type: 'collection' }
  }

  /**
   * @param {string} name
   * @param {string} href
   */
  linkCollection(name, href) {
    const links = this.document._metadata.links
    links[name] = { href: href, type: 'collection' }
  }

  /**
   * @param {string} name
   * @param {string} href
   */
  linkRelation(name, href) {
    const links = this.document._metadata.links
    links[name] = { href: href, type: 'relation' }
  }

  /** @param {string} name */
  getNextPolicy(name) {
    return /** @type {import('./traversalPolicy')} */ (this.policy).getNextPolicy(name)
  }

  /**
   * @param {any} requests
   * @param {string | null} [name]
   * @param {string | null} [scope]
   */
  queueRequests(requests, name = null, scope = null) {
    requests = Array.isArray(requests) ? requests : [requests]
    const toQueue = requests.filter(/** @param {any} request */ request => !this.hasSeen(request))
    this.track(this.crawler.queue(toQueue, name, scope))
  }

  /**
   * @param {string} type
   * @param {string} url
   * @param {any} policy
   * @param {Record<string, any> | null} [context]
   * @param {boolean} [pruneRelation]
   * @param {string | null} [scope]
   */
  queue(type, url, policy, context = null, pruneRelation = true, scope = null) {
    if (!policy) {
      return
    }
    context = Object.assign({}, this.context, context)
    context.qualifier = context.qualifier || 'urn:'
    const newRequest = new Request(type, url, context)
    newRequest.policy = policy
    // relations are not transitive so ensure any relation is stripped off
    if (pruneRelation) {
      newRequest.context.relation = undefined
    }
    this.queueRequests(newRequest, _.get(this._originQueue, 'queue.name'), scope)
  }

  /**
   * @param {string} outcome
   * @param {string} message
   */
  markDead(outcome, message) {
    this.track(this.crawler.storeDeadletter(this, message))
    return this.markSkip(outcome, message)
  }

  /**
   * @param {string} outcome
   * @param {string} [message]
   */
  markSkip(outcome, message) {
    return this._cutShort(outcome, message, 'skip')
  }

  /**
   * @param {string} outcome
   * @param {string} message
   */
  markRequeue(outcome, message) {
    this._addHistory(` Requeued: ${outcome} ${message}`)
    return this._cutShort(outcome, message, 'requeue')
  }

  /**
   * @param {string} outcome
   * @param {string} message
   */
  markDefer(outcome, message) {
    this.crawler.queues.defer(this)
    return this._cutShort(outcome, message, 'defer')
  }

  /**
   * @param {string} outcome
   * @param {string} message
   * @param {string} reason
   */
  _cutShort(outcome, message, reason) {
    // if we are already skipping/requeuing, keep the original as the official outcome but log this new one so its not missed
    if (this.shouldSkip()) {
      this._log('verbose', `Redundant ${reason}: ${outcome}, ${message}`, this.meta)
      return this
    }
    this.processControl = reason
    // overwrite previous outcomes if this is an error and the current is not.
    if (outcome === 'Error' && this.outcome !== 'Error') {
      this.outcome = outcome
      this.message = message
    } else {
      this.outcome = this.outcome || outcome
      this.message = this.message || message
    }
    return this
  }

  markSave() {
    this.save = true
    return this
  }

  markNoSave() {
    this.save = false
    return this
  }

  shouldSave() {
    return this.document && (this.save === true || (this.save !== false && this.contentOrigin !== 'cacheOfOrigin'))
  }

  shouldSkip() {
    return this.processControl === 'skip' || this.processControl === 'requeue' || this.processControl === 'defer'
  }

  isDeferred() {
    return this.processControl === 'defer'
  }

  /** @param {number} time */
  delayUntil(time) {
    if (!this.nextRequestTime || this.nextRequestTime < time) {
      this.nextRequestTime = time
    }
  }

  delay(milliseconds = 2000) {
    this.delayUntil(Date.now() + milliseconds)
  }

  shouldRequeue() {
    return this.processControl === 'requeue'
  }

  createRequeuable() {
    // Create a new request data structure that has just the things we should queue
    const queuable = new Request(this.type, this.url, this.context)
    queuable.attemptCount = this.attemptCount
    queuable.policy = this.policy
    if (this.payload) {
      queuable.payload = this.payload
    }
    return queuable
  }

  toString() {
    return `${this.type}@${this._trimUrl(this.url)}`
  }

  toUniqueString() {
    const policyName = this.policy ? Request._getResolvedPolicy(this).getShortForm() : 'NN'
    return `${this.type}@${this.url}:${policyName}`
  }

  /** @param {string} url */
  _trimUrl(url) {
    return url ? url.replace('https://api.github.com', '') : ''
  }

  /**
   * @param {string} level
   * @param {string} message
   * @param {any} [meta]
   */
  _log(level, message, meta = null) {
    if (this.crawler) {
      this.crawler.logger.log(level, message, meta)
    }
  }
}

module.exports = Request
