// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const proxyquire = require('proxyquire')
const sinon = require('sinon')

describe('azureBlobFactory auth selection', () => {
  let BlobServiceClient
  let DefaultAzureCredential
  let ClientSecretCredential
  let AzureStorageDocStore
  let createAzureBlobStore

  beforeEach(() => {
    BlobServiceClient = sinon.spy(function BlobServiceClient(url, credential, options) {
      this.url = url
      this.credential = credential
      this.options = options
      this.getContainerClient = sinon.stub().returns({ name: 'container-client' })
    })
    BlobServiceClient.fromConnectionString = sinon.stub().returns({
      getContainerClient: sinon.stub().returns({ name: 'container-from-connection-string' })
    })

    DefaultAzureCredential = sinon.stub().returns({ type: 'default' })
    ClientSecretCredential = sinon.stub().returns({ type: 'spn' })
    AzureStorageDocStore = sinon.spy(function AzureStorageDocStore(containerClient, options) {
      this.containerClient = containerClient
      this.options = options
    })

    createAzureBlobStore = proxyquire('../../../../ghcrawler/providers/storage/azureBlobFactory', {
      '@azure/storage-blob': {
        BlobServiceClient,
        StorageRetryPolicyType: { EXPONENTIAL: 'EXPONENTIAL' }
      },
      '@azure/identity': { DefaultAzureCredential, ClientSecretCredential },
      './storageDocStore': AzureStorageDocStore
    })
  })

  it('prefers managed identity over SPN and connection string', () => {
    createAzureBlobStore({
      account: 'blob-account',
      container: 'blob-container',
      connection: 'UseDevelopmentStorage=true',
      spnAuth: JSON.stringify({ tenantId: 'tenant', clientId: 'client', clientSecret: 'secret' }),
      isSpnAuth: true,
      useManagedIdentity: 'true',
      logger: { info: sinon.stub() }
    })

    expect(DefaultAzureCredential.calledOnce).to.be.true
    expect(ClientSecretCredential.called).to.be.false
    expect(BlobServiceClient.fromConnectionString.called).to.be.false
    expect(BlobServiceClient.calledOnce).to.be.true
    expect(BlobServiceClient.firstCall.firstArg).to.equal('https://blob-account.queue.core.windows.net')
    expect(AzureStorageDocStore.calledOnce).to.be.true
  })

  it('uses connection string when managed identity is disabled', () => {
    createAzureBlobStore({
      account: 'blob-account',
      container: 'blob-container',
      connection: 'UseDevelopmentStorage=true',
      isSpnAuth: false,
      useManagedIdentity: 'false',
      logger: { info: sinon.stub() }
    })

    expect(BlobServiceClient.fromConnectionString.calledOnce).to.be.true
    expect(DefaultAzureCredential.called).to.be.false
    expect(ClientSecretCredential.called).to.be.false
    expect(BlobServiceClient.called).to.be.false
  })
})
