// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const config = require('painless-config');

const clearlyDefined = {
  url: config.get('CRAWLER_STORE_URL'),
  token: config.get('CRAWLER_STORE_TOKEN')
};

const azblob = {
  connection: config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
  container: config.get('HARVEST_AZBLOB_CONTAINER_NAME')
}

const file = {
  location: config.get('FILE_STORE_LOCATION') || process.platform === 'win32' ? 'c:/temp/cd' : '/tmp/cd'
};

module.exports =
  {
    provider: 'memory',  // change this to redis if/when we want distributed config
    searchPath: [module],
    crawler: {
      count: 1,
      drainPulse: 1
    },
    filter: {
      provider: 'filter',
      filter: {}
    },
    fetch: {
      dispatcher: 'cdDispatch',
      cdDispatch: {},
      git: {},
      npm: {}
    },
    process: {
      source: {},
      scancode: {
        installDir: config.get('SCANCODE_HOME') || 'C:\\installs\\scancode-toolkit-2.2.1',
        options: ['--copyright', '--license', '--info', '--diag', '--only-findings', ' --strip-root', '--quiet'],
        timeout: 300,
        processes: 3,
        format: 'json-pp'
      },
      npm: {
        githubToken: config.get('CRAWLER_GITHUB_TOKEN')
      },
      top: {}
    },
    store: {
      provider: config.get('CRAWLER_STORE_PROVIDER') || 'file',
      clearlyDefined,
      azblob,
      file
    },
    deadletter: {
      provider: config.get('CRAWLER_STORE_PROVIDER') || 'file',
      clearlyDefined,
      azblob,
      file
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
        credit: 5,
        messageSize: 240,
        parallelPush: 10,
        pushRateLimit: 200,
        // metricsStore: 'redis',
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
  };

