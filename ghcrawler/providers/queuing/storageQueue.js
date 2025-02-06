// Copyright (c) Microsoft Corporation and others. Made available under the MIT license.
// SPDX-License-Identifier: MIT

// eslint-disable-next-line no-unused-vars
const { QueueServiceClient } = require('@azure/storage-queue')
const qlimit = require('qlimit')
const { cloneDeep } = require('lodash')

class StorageQueue {
  /**
   * @param {QueueServiceClient} client
   * @param {string} name
   * @param {string} queueName
   * @param {object} formatter
   * @param {object} options
   */
  constructor(client, name, queueName, formatter, options) {
    this.name = name
    this.queueName = queueName
    this.messageFormatter = formatter
    this.options = options
    this.logger = options.logger
    this.queueClient = client.getQueueClient(this.queueName)
  }

  async subscribe() {
    await this.queueClient.createIfNotExists()
    this.logger.info(`Subscribed to ${this.queueName} using Queue Storage`)
  }

  async unsubscribe() {
    // No specific unsubscribe logic for Azure Queue Storage
  }

  async push(requests) {
    requests = Array.isArray(requests) ? requests : [requests]
    return Promise.all(
      requests.map(
        qlimit(this.options.parallelPush || 1)(async request => {
          const body = JSON.stringify(request)
          const encoded = this._encodeXMLSafe(body)
          const queueMessageResult = await this.queueClient.sendMessage(encoded)
          this._log('Queued', request)
          return this._buildMessageReceipt(queueMessageResult, request)
        })
      )
    )
  }

  _buildMessageReceipt(queueMessageResult, requestBody) {
    const _message = { ...queueMessageResult, body: cloneDeep(requestBody) }
    return { _message }
  }

  async pop() {
    const msgOptions = { numberOfMessages: 1, visibilityTimeout: this.options.visibilityTimeout || 60 * 60 }
    const response = await this.queueClient.receiveMessages(msgOptions)
    const message = response.receivedMessageItems[0]
    if (!message) {
      this.logger.verbose('No messages to receive')
      return null
    }
    if (this.options.maxDequeueCount && message.dequeueCount > this.options.maxDequeueCount) {
      this.logger.verbose('maxDequeueCount exceeded')
      try {
        await this.queueClient.deleteMessage(message.messageId, message.popReceipt)
      } catch (error) {
        this.logger.error(`Failed to delete message ${message.messageId} in storageQueue, error: ${error.message}`)
        throw error
      }
      return null
    } else {
      try {
        const decodedText = this._decodeXMLSafe(message.messageText)
        message.body = JSON.parse(decodedText)
      } catch (error) {
        this.logger.error(`Failed to parse message ${message.messageId}:`)
        this.logger.error(`Raw message: ${message.messageText}`)
        this.logger.error(`Parse error: ${error.message}`)
        await this.queueClient.deleteMessage(message.messageId, message.popReceipt)
        return null
      }
      const request = this.messageFormatter(message)
      request._message = message
      this._log('Popped', message.body)
      return request
    }
  }

  async done(request) {
    if (!request || !request._message) {
      return
    }
    await this.queueClient.deleteMessage(request._message.messageId, request._message.popReceipt)
    this._log('ACKed', request._message.body)
  }

  async defer(request) {
    return this.abandon(request)
  }

  async abandon(request) {
    if (!request || !request._message) {
      return
    }
    await this.updateVisibilityTimeout(request)
  }

  async updateVisibilityTimeout(request, visibilityTimeout = 0) {
    const response = await this.queueClient.updateMessage(
      request._message.messageId,
      request._message.popReceipt,
      undefined,
      visibilityTimeout
    )
    this._log('NAKed', request._message.body)
    return this._buildMessageReceipt({ messageId: request._message.messageId, ...response }, request)
  }

  async flush() {
    await this.queueClient.clearMessages()
    this.logger.info(`Flushed all messages from ${this.queueName}`)
  }

  async getInfo() {
    try {
      const properties = await this.queueClient.getProperties()
      return { count: properties.approximateMessagesCount }
    } catch (error) {
      this.logger.error(error)
      return null
    }
  }

  getName() {
    return this.name
  }

  _log(actionMessage, message) {
    this.logger.verbose(`${actionMessage} ${message.type} ${message.url}`)
  }

  isMessageNotFound(error) {
    return error?.code === 'MessageNotFound'
  }

  _encodeXMLSafe(text) {
    if (typeof text !== 'string') return text

    return (
      text
        // Handle & first to prevent double-encoding
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    )
  }

  _decodeXMLSafe(text) {
    if (typeof text !== 'string') return text

    return (
      text
        // Handle both XML and HTML encodings for quotes and apostrophes
        .replace(/&apos;|&#39;|&#x27;/g, "'")
        .replace(/&quot;|&#34;|&#x22;/g, '"')
        // Handle basic XML entities
        .replace(/&lt;|&#60;|&#x3[Cc];/g, '<')
        .replace(/&gt;|&#62;|&#x3[Ee];/g, '>')
        .replace(/&amp;|&#38;|&#x26;/g, '&') // Must be after other & entities
    )
  }
}

module.exports = StorageQueue
