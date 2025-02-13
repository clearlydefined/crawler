// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { DefaultAzureCredential, ClientSecretCredential } = require('@azure/identity')
const { QueueServiceClient, StorageRetryPolicyType } = require('@azure/storage-queue')

class AzureStorageQueue {
  constructor(options) {
    this.options = options
    this.queueName = options.queueName
    this.logger = options.logger

    const { connectionString, account, spnAuth } = options

    const pipelineOptions = {
      retryOptions: {
        maxTries: 3,
        retryDelayInMs: 1000,
        maxRetryDelayInMs: 120 * 1000,
        tryTimeoutInMs: 30000,
        retryPolicyType: StorageRetryPolicyType.FIXED
      }
    }
    if (connectionString) {
      this.client = QueueServiceClient.fromConnectionString(connectionString, pipelineOptions)
    } else {
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

  async connect() {
    this.queueService = this.client.getQueueClient(this.queueName)
    this.queueService.createIfNotExists()
  }

  async upsert(document) {
    const message = Buffer.from(JSON.stringify({ _metadata: document._metadata })).toString('base64')
    return await this.queueService.sendMessage(message)
  }

  get() {
    return null
  }

  etag() {
    return null
  }

  list() {
    return null
  }

  count() {
    return null
  }

  close() {
    return null
  }

  delete() {
    return null
  }
}

module.exports = options => new AzureStorageQueue(options)
