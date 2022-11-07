// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const NestedQueue = require('./nestedQueue')

const VISIBILITY_TIMEOUT_TO_REMAIN_ON_LOCAL_QUEUE = 8 * 60 * 60 // 8 hours
const VISIBILITY_TIMEOUT_FOR_PROCESSING = 1 * 60 * 60 // 1 hours, similar to storage queue pop visibility timeout

class StorageBackedQueue extends NestedQueue {

  constructor(queue, storageQueue, options) {
    super(queue)
    this.options = options
    this.logger = options.logger
    this._sharedStorageQueue = storageQueue
  }

  async push(requests) {
    requests = Array.isArray(requests) ? requests : [requests]
    await this._pushToStorage(requests)
    await super.push(requests)
  }

  async _pushToStorage(requests) {
    const visibilityTimeout = this.options.visibilityTimeout_remainLocal
    const storageReceipts = await this._sharedStorageQueue.push(requests, { visibilityTimeout })
    requests.map((request, index) => Object.assign(request, storageReceipts[index]))
  }

  async pop() {
    const request = await super.pop()
    if (!request) return
    const success = await this._hideInStorage(request)
    if (success) return request
    return await this.pop()
  }

  async _hideInStorage(request) {
    try {
      const receipt = await this._sharedStorageQueue.updateVisibilityTimeout(request, this.options.visibilityTimeout)
      Object.assign(request, receipt)
      return true
    } catch (error) {
      if (!this._sharedStorageQueue.isMessageNotFound(error)) throw error
      // Message not found for the popReceipt and messageId stored in the request.  This means
      // that the message popReceipt (and possibly messageId) in the request is stale. This can
      // happen when the message visibility timeout expired and thus was visible and later
      // updated/processed by others. Because the request is picked up by others, just log and
      // continue to the next.
      this._log('Failed to update stale message', request)
      return false
    }
  }

  async done(request) {
    await Promise.all([
      super.done(request),
      this._doneInStorage(request)])
  }

  async _doneInStorage(request) {
    try {
      await this._sharedStorageQueue.done(request)
    } catch (error) {
      if (!this._sharedStorageQueue.isMessageNotFound(error)) throw error
      // Message not found for the popReceipt and messageId stored in the request.  This means
      // that the message popReceipt (and possibly messageId) in the request is stale. This can
      // happen when the message visibility timeout expired and thus was visible and later
      // updated by others. This is ok because the deletion of the request can be left to the
      // caller with the updated popReceipt. Log and continue.
      this._log('Failed to remove stale message', request)
    }
  }

  async subscribe() {
    await Promise.all([
      super.subscribe(),
      this._sharedStorageQueue.subscribe()])
  }

  async unsubscribe() {
    const results = await Promise.allSettled([
      super.unsubscribe(),
      this._sharedStorageQueue.unsubscribe()])
    this._throwIfError(results, 'Failed to unsubscribe')
  }

  async flush() {
    const deleteRequests = []
    const info = await this.getInfo()
    for (let count = info.count; count > 0; count--) {
      const deleteOne = super.pop().then(request => this.done(request))
      deleteRequests.push(deleteOne)
    }
    const results = await Promise.allSettled(deleteRequests)
    this._throwIfError(results, 'Failed to flush')
  }

  _throwIfError(results, message) {
    const errors = results.filter(result => result.status === 'rejected')
      .map(rejected => new Error(rejected.reason))
    if (errors.length) throw new AggregateError(errors, message)
  }

  _log(actionMessage, request) {
    this.logger.verbose(`${actionMessage} ${request.type} ${request.url}`)
  }

  static create(queue, storageQueue, options = {}) {
    const defaultOptions = {
      visibilityTimeout_remainLocal: VISIBILITY_TIMEOUT_TO_REMAIN_ON_LOCAL_QUEUE,
      visibilityTimeout: VISIBILITY_TIMEOUT_FOR_PROCESSING
    }
    const optionsWithDefaults = { ...defaultOptions, ...options }
    return new StorageBackedQueue(queue, storageQueue, optionsWithDefaults)
  }
}

module.exports = StorageBackedQueue
