// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

// @ts-check
const { BlobServiceClient, StorageRetryPolicyType } = require('@azure/storage-blob')
const AzureStorageDocStore = require('./storageDocStore')
const { DefaultAzureCredential, ClientSecretCredential } = require('@azure/identity')

/**
 * @param {object} options
 * @param {string} options.account
 * @param {string} options.connection
 * @param {string} options.container
 * @param {object} options.logger
 * @param {object} options.spnAuth
 * @param {object} options.isSpnAuth
 */
module.exports = options => {
  options.logger.info('creating azure storage store')
  const { account, connection, container, spnAuth, isSpnAuth } = options

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

  if (isSpnAuth) {
    options.logger.info('using service principal credentials in azureBlobFactory')
    const authParsed = JSON.parse(spnAuth)
    blobServiceClient = new BlobServiceClient(
      `https://${account}.queue.core.windows.net`,
      new ClientSecretCredential(authParsed.tenantId, authParsed.clientId, authParsed.clientSecret),
      pipelineOptions
    )
  } else {
    if (connection) {
      options.logger.info('using connection string in azureBlobFactory')
      blobServiceClient = BlobServiceClient.fromConnectionString(connection, pipelineOptions)
    } else {
      options.logger.info('using default credentials in azureBlobFactory')
      blobServiceClient = new BlobServiceClient(
        `https://${account}.queue.core.windows.net`,
        new DefaultAzureCredential(),
        pipelineOptions
      )
    }
  }

  const containerClient = blobServiceClient.getContainerClient(container)

  return new AzureStorageDocStore(containerClient, options)
}
