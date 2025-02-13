// Copyright (c) Microsoft Corporation and others. Made available under the MIT license.
// SPDX-License-Identifier: MIT

const AttenuatedQueue = require('./attenuatedQueue')
const { QueueServiceClient, StorageRetryPolicyType } = require('@azure/storage-queue')
const Request = require('../../lib/request')
const StorageQueue = require('./storageQueue')
const { DefaultAzureCredential, ClientSecretCredential } = require('@azure/identity')

class StorageQueueManager {
  constructor(connectionString, options) {
    const pipelineOptions = {
      retryOptions: {
        maxTries: 3,
        retryDelayInMs: 1000,
        maxRetryDelayInMs: 120 * 1000,
        tryTimeoutInMs: 30000,
        retryPolicyType: StorageRetryPolicyType.EXPONENTIAL
      }
    }

    const { account, spnAuth, isSpnAuth } = options
    if (isSpnAuth) {
      const authParsed = JSON.parse(spnAuth)
      this.client = new QueueServiceClient(
        `https://${account}.queue.core.windows.net`,
        new ClientSecretCredential(authParsed.tenantId, authParsed.clientId, authParsed.clientSecret),
        pipelineOptions
      )
      return
    }

    if (connectionString) {
      this.client = QueueServiceClient.fromConnectionString(connectionString, pipelineOptions)
      return
    }

    this.client = new QueueServiceClient(
      `https://${account}.queue.core.windows.net`,
      new DefaultAzureCredential(),
      pipelineOptions
    )
  }

  createQueueClient(name, formatter, options) {
    return new StorageQueue(this.client, name, `${options.queueName}-${name}`, formatter, options)
  }

  createQueueChain(name, options) {
    const queue = this.createQueue(name, options)
    return new AttenuatedQueue(queue, options)
  }

  createQueue(name, options) {
    const formatter = message => {
      // make sure the message/request object is copied to enable deferral scenarios (i.e., the request is modified
      // and then put back on the queue)
      return Request.adopt(Object.assign({}, message.body))
    }
    return this.createQueueClient(name, formatter, options)
  }
}

module.exports = StorageQueueManager
