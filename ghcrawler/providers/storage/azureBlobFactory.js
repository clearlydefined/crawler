// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

// @ts-check
const { BlobServiceClient, StorageRetryPolicyType } = require('@azure/storage-blob')
const AzureStorageDocStore = require('./storageDocStore')
const { DefaultAzureCredential } = require ('@azure/identity');

/**
 * @param {object} options
 * @param {string} options.account
 * @param {string} options.connection
 * @param {string} options.container
 * @param {object} options.logger
 */
module.exports = options => {
  options.logger.info('creating azure storage store')
  const { account, connection, container } = options

  const pipelineOptions = {
    retryOptions: {
      maxTries: 3,
      retryDelayInMs: 1000,
      maxRetryDelayInMs: 120 * 1000,
      tryTimeoutInMs: 30000,
      retryPolicyType: StorageRetryPolicyType.EXPONENTIAL
    }
  }

  let blobServiceClient
  if (connection) {
    options.logger.info('using connection string')
    blobServiceClient = BlobServiceClient.fromConnectionString(connection, pipelineOptions)
  } else if (account) {
    options.logger.info('using default credentials')
    blobServiceClient = new BlobServiceClient(`https://${account}.blob.core.windows.net`, new DefaultAzureCredential(), pipelineOptions)
  } else {
    throw new Error('either connection or account must be provided')
  }

  const containerClient = blobServiceClient.getContainerClient(container)

  return new AzureStorageDocStore(containerClient, options)
}
