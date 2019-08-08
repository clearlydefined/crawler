// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')

const cd_azblob = {
  connection: config.get('CRAWLER_AZBLOB_CONNECTION_STRING'),
  container: config.get('CRAWLER_AZBLOB_CONTAINER_NAME')
}

const githubToken = config.get('CRAWLER_GITHUB_TOKEN')

const cd_file = {
  location: config.get('FILE_STORE_LOCATION') || (process.platform === 'win32' ? 'c:/temp/cd' : '/tmp/cd')
}
const crawlerStoreProvider = config.get('CRAWLER_STORE_PROVIDER') || 'cd(file)'

module.exports = {
  provider: 'memory', // change this to redis if/when we want distributed config
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
    cocoapods: { githubToken },
    cratesio: {},
    git: {},
    mavenCentral: {},
    npmjs: {},
    nuget: {},
    pypi: {},
    rubygems: {}
  },
  process: {
    cdsource: {},
    component: {},
    crate: { githubToken },
    fossology: {
      disabled: true,
      installDir: config.get('FOSSOLOGY_HOME') || '/mnt/c/git/fo/fossology/src/'
    },
    gem: { githubToken },
    licensee: {},
    maven: { githubToken },
    npm: { githubToken },
    nuget: { githubToken },
    package: {},
    pod: { githubToken },
    pypi: { githubToken },
    scancode: {
      installDir: config.get('SCANCODE_HOME') || 'C:\\installs\\scancode-toolkit-3.0.2',
      options: [
        '--copyright',
        '--license',
        '--info',
        '--license-text',
        '--is-license-text',
        '--package',
        '--license-diag',
        '--strip-root',
        '--email',
        '--url',
        '--license-clarity-score',
        '--classify',
        '--generated',
        '--summary',
        '--summary-key-files'
        // '--quiet'
      ],
      timeout: 1000,
      processes: 2,
      format: '--json-pp'
    },
    source: {},
    top: { githubToken }
  },
  store: {
    dispatcher: crawlerStoreProvider,
    cdDispatch: {},
    webhook: {
      url: config.get('CRAWLER_WEBHOOK_URL') || 'http://localhost:4000/webhook',
      token: config.get('CRAWLER_WEBHOOK_TOKEN')
    },
    azqueue: {
      connectionString: cd_azblob.connection,
      queueName: config.get('CRAWLER_HARVESTS_QUEUE_NAME') || 'harvests'
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
    amqp10: {
      weights: { immediate: 3, soon: 2, normal: 3, later: 2 },
      managementEndpoint: config.get('CRAWLER_SERVICEBUS_MANAGER_ENDPOINT'),
      url: config.get('CRAWLER_AMQP10_URL'),
      queueName: config.get('CRAWLER_QUEUE_PREFIX') || 'cdcrawlerdev',
      enablePartitioning: true,
      credit: 5,
      messageSize: 240,
      parallelPush: 10,
      pushRateLimit: 200,
      // metricsStore: 'redis',
      attenuation: {
        ttl: 3000
      }
    },
    serviceBus: {
      weights: { immediate: 3, soon: 2, normal: 3, later: 2 },
      connectionString:
        config.get('CRAWLER_SERVICEBUS_CONNECTION_STRING') || config.get('CRAWLER_SERVICEBUS_MANAGER_ENDPOINT'),
      queueName: config.get('CRAWLER_QUEUE_PREFIX') || 'cdcrawlerdev',
      enablePartitioning: 'false', // Service Bus APIs do not support partitioning yet
      maxSizeInMegabytes: '5120',
      lockDuration: 'PT5M', // 5 min
      lockRenewal: 4.75 * 60 * 1000, // 4 min 45 sec
      maxDeliveryCount: 100,
      attenuation: {
        ttl: 3000
      }
    },
    storageQueue: {
      weights: { immediate: 3, soon: 2, normal: 3, later: 2 },
      connectionString: cd_azblob.connection,
      queueName: config.get('CRAWLER_QUEUE_PREFIX') || 'cdcrawlerdev',
      visibilityTimeout: 8 * 60 * 60, // 8 hours
      maxDequeueCount: 5,
      attenuation: {
        ttl: 3000
      }
    }
  },
  redis: {
    // provider: redis
    redis: {
      // redis config options go here
    }
  }
}
