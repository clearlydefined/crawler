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
    if (connectionString) {
      this.client = QueueServiceClient.fromConnectionString(connectionString, pipelineOptions)
    } else {
      const { account, spnAuth } = options
      let credential
      if (spnAuth) {
        const authParsed = JSON.parse(spnAuth)
        credential = new ClientSecretCredential(authParsed.tenantId, authParsed.clientId, authParsed.clientSecret)
      } else {
        credential = new DefaultAzureCredential()
      }
      this.client = new QueueServiceClient(`https://${account}.queue.core.windows.net`, credential, pipelineOptions)
    }
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
