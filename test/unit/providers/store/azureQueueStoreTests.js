// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const { expect } = require('chai')
const proxyquire = require('proxyquire')
const sinon = require('sinon')

describe('azureQueueStore auth selection', () => {
  let QueueServiceClient
  let DefaultAzureCredential
  let ClientSecretCredential
  let createAzureQueueStore

  beforeEach(() => {
    QueueServiceClient = sinon.spy(function QueueServiceClient(url, credential, options) {
      this.url = url
      this.credential = credential
      this.options = options
    })
    QueueServiceClient.fromConnectionString = sinon.stub().returns({ fromConnectionString: true })

    DefaultAzureCredential = sinon.stub().returns({ type: 'default' })
    ClientSecretCredential = sinon.stub().returns({ type: 'spn' })

    createAzureQueueStore = proxyquire('../../../../providers/store/azureQueueStore', {
      '@azure/storage-queue': {
        QueueServiceClient,
        StorageRetryPolicyType: { FIXED: 'FIXED' }
      },
      '@azure/identity': { DefaultAzureCredential, ClientSecretCredential }
    })
  })

  it('prefers managed identity over SPN and connection string', () => {
    createAzureQueueStore({
      queueName: 'harvests',
      account: 'queue-account',
      connectionString: 'UseDevelopmentStorage=true',
      spnAuth: JSON.stringify({ tenantId: 'tenant', clientId: 'client', clientSecret: 'secret' }),
      isSpnAuth: true,
      useManagedIdentity: 'true',
      logger: { info: sinon.stub() }
    })

    expect(DefaultAzureCredential.calledOnce).to.be.true
    expect(ClientSecretCredential.called).to.be.false
    expect(QueueServiceClient.fromConnectionString.called).to.be.false
    expect(QueueServiceClient.calledOnce).to.be.true
    expect(QueueServiceClient.firstCall.firstArg).to.equal('https://queue-account.queue.core.windows.net')
  })

  it('uses connection string when managed identity is disabled', () => {
    createAzureQueueStore({
      queueName: 'harvests',
      account: 'queue-account',
      connectionString: 'UseDevelopmentStorage=true',
      isSpnAuth: false,
      useManagedIdentity: 'false',
      logger: { info: sinon.stub() }
    })

    expect(QueueServiceClient.fromConnectionString.calledOnce).to.be.true
    expect(DefaultAzureCredential.called).to.be.false
    expect(ClientSecretCredential.called).to.be.false
  })
})
