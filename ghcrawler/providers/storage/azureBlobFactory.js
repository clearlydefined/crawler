// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

// @ts-check
const { BlobServiceClient, StorageRetryPolicyType } = require('@azure/storage-blob')
const AzureStorageDocStore = require('./storageDocStore')
const { DefaultAzureCredential, ClientSecretCredential } = require('@azure/identity')

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info
 */

/**
 * @param {object} options
 * @param {string} options.account
 * @param {string} options.connection
 * @param {string} options.container
 * @param {Logger} options.logger
 * @param {string} options.spnAuth
 * @param {string} options.blobKey
 * @param {boolean} options.preserveCase
 */
module.exports = options => {
  options.logger.info('creating azure storage store')
  const { account, connection, container, spnAuth } = options

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
  } else {
    let credential
    if (spnAuth) {
      const authParsed = JSON.parse(spnAuth)
      credential = new ClientSecretCredential(authParsed.tenantId, authParsed.clientId, authParsed.clientSecret)
      options.logger.info('using service principal credentials')
    } else {
      credential = new DefaultAzureCredential()
      options.logger.info('using default credentials')
    }
    blobServiceClient = new BlobServiceClient(`https://${account}.blob.core.windows.net`, credential, pipelineOptions)
  }

  const containerClient = blobServiceClient.getContainerClient(container)

  return new AzureStorageDocStore(containerClient, options)
}
