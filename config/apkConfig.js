// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')

const cd_azblob = {
  connection: config.get('CRAWLER_AZBLOB_CONNECTION_STRING'),
  container: config.get('CRAWLER_AZBLOB_CONTAINER_NAME')
}

const cd_file = {
  location: config.get('FILE_STORE_LOCATION') || (process.platform === 'win32' ? 'c:/temp/cd' : '/tmp/cd')
}
const crawlerStoreProvider = config.get('CRAWLER_STORE_PROVIDER') || 'cd(file)'

module.exports = {
  provider: 'memory',
  searchPath: [module],
  crawler: {
    count: 2
  },
  filter: {
    provider: 'filter',
    filter: {}
  },
  fetch: {
    dispatcher: 'cdDispatch',
    cdDispatch: {},
    apk: {}
  },
  process: {
    apk: {}
  },
  store: {
    dispatcher: crawlerStoreProvider,
    cdDispatch: {},
    webhook: {
      url: config.get('CRAWLER_WEBHOOK_URL') || 'http://localhost:4000/webhook',
      token: config.get('CRAWLER_WEBHOOK_TOKEN')
    },
    'cd(azblob)': cd_azblob,
    'cd(file)': cd_file
  },
  deadletter: {
    provider: config.get('CRAWLER_DEADLETTER_PROVIDER') || crawlerStoreProvider,
    'cd(azblob)': cd_azblob,
    'cd(file)': cd_file
  },
  queue: {
    provider: config.get('CRAWLER_QUEUE_PROVIDER') || 'memory',
    memory: {
      weights: { immediate: 3, soon: 2, normal: 3, later: 2 }
    },
    storageQueue: {
      weights: { immediate: 3, soon: 2, normal: 3, later: 2 },
      connectionString: cd_azblob.connection,
      queueName: config.get('CRAWLER_APK_QUEUE_PREFIX') || 'cdcrawlerdevapk',
      visibilityTimeout: 3 * 60 * 60, // 3 hours
      maxDequeueCount: 5,
      attenuation: {
        ttl: 3000
      }
    }
  }
}
