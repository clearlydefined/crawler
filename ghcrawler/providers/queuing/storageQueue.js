// Copyright (c) Microsoft Corporation and others. Made available under the MIT license.
// SPDX-License-Identifier: MIT

const qlimit = require('qlimit')

class StorageQueue {
  constructor(client, name, queueName, formatter, options) {
    this.client = client
    this.name = name
    this.queueName = queueName
    this.messageFormatter = formatter
    this.options = options
    this.logger = options.logger
  }

  async subscribe() {
    return new Promise((resolve, reject) => {
      this.client.createQueueIfNotExists(this.queueName, error => {
        if (error) {
          return reject(error)
        }
        this.logger.info(`Subscribed to ${this.queueName} using Queue Storage`)
        resolve()
      })
    })
  }

  async unsubscribe() {
    return
  }

  async push(requests) {
    requests = Array.isArray(requests) ? requests : [requests]
    return Promise.all(
      requests.map(
        qlimit(this.options.parallelPush || 1)(request => {
          const body = JSON.stringify(request)
          return new Promise((resolve, reject) => {
            this.client.createMessage(this.queueName, body, error => {
              if (error) {
                return reject(error)
              }
              this._log('Queued', request)
              resolve()
            })
          })
        })
      )
    )
  }

  async pop() {
    const msgOptions = { numOfMessages: 1, visibilityTimeout: this.options.visibilityTimeout || 60 * 60 }
    return new Promise((resolve, reject) => {
      this.client.getMessages(this.queueName, msgOptions, (error, result) => {
        if (error) {
          return reject(error)
        }
        const message = result[0]
        if (!message) {
          this.logger.verbose('No messages to receive')
          return resolve(null)
        }
        if (this.options.maxDequeueCount && message.dequeueCount > this.options.maxDequeueCount) {
          this.logger.verbose('maxDequeueCount exceeded')
          this.client.deleteMessage(this.queueName, message.messageId, message.popReceipt, error => {
            if (error) return reject(error)
            resolve(null)
          })
        } else {
          message.body = JSON.parse(message.messageText)
          const request = this.messageFormatter(message)
          request._message = message
          this._log('Popped', message.body)
          resolve(request)
        }
      })
    })
  }

  async done(request) {
    if (!request || !request._message) {
      return
    }
    return new Promise((resolve, reject) => {
      this.client.deleteMessage(this.queueName, request._message.messageId, request._message.popReceipt, error => {
        if (error) {
          return reject(error)
        }
        this._log('ACKed', request._message.body)
        resolve()
      })
    })
  }

  async defer(request) {
    return this.abandon(request)
  }

  async abandon(request) {
    if (!request || !request._message) {
      return
    }
    return new Promise((resolve, reject) => {
      // visibilityTimeout is updated to 0 to unlock/unlease the message
      this.client.updateMessage(this.queueName, request._message.messageId, request._message.popReceipt, 0, error => {
        if (error) {
          return reject(error)
        }
        this._log('NAKed', request._message.body)
        resolve()
      })
    })
  }

  async flush() {
    return new Promise((resolve, reject) => {
      this.client.deleteQueue(this.queueName, error => {
        if (error) return reject(error)
        this.client.createQueueIfNotExists(this.queueName, error => {
          if (error) return reject(error)
          resolve()
        })
      })
    })
  }

  async getInfo() {
    return new Promise(resolve => {
      this.client.getQueueMetadata(this.queueName, (result, error) => {
        if (error) {
          this.logger.error(error)
          resolve(null)
        }
        resolve({ count: result[0].approximateMessageCount })
      })
    })
  }

  getName() {
    return this.name
  }

  _log(actionMessage, message) {
    this.logger.verbose(`${actionMessage} ${message.type} ${message.url}`)
  }
}

module.exports = StorageQueue
