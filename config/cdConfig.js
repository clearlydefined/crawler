// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const config = require('painless-config');

const azblob = {
  connection: config.get('HARVEST_AZBLOB_CONNECTION_STRING'),
  container: config.get('HARVEST_AZBLOB_CONTAINER_NAME')
}

const file = {
  location: config.get('FILE_STORE_LOCATION') || (process.platform === 'win32' ? 'c:/temp/cd' : '/tmp/cd')
};

module.exports =
  {
    provider: 'memory',  // change this to redis if/when we want distributed config
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
      git: {},
      mavenCentral: {},
      npmjs: {}
    },
    process: {
      cdsource: {},
      maven: {},
      npm: {
        githubToken: config.get('CRAWLER_GITHUB_TOKEN')
      },
      package: {},
      scancode: {
        installDir: config.get('SCANCODE_HOME') || 'C:\\installs\\scancode-toolkit-2.2.1',
        options: ['--copyright', '--license', '--info', '--package', '--diag', '--only-findings', ' --strip-root', '--quiet'],
        timeout: 1000,
        processes: 2,
        format: 'json-pp',
        maxCount: 1000,  // Maximum file count in repo for local processing. Above this scanning is done as a build
        maxSize: 5 * 1024, // Maximum repo size in KB after which scancode would run in build and not directly in crawler
        build: {
          crawlerUrl: config.get('CRAWLER_SERVICE_URL') || 'http://localhost:5000',
          crawlerAuthToken: config.get('CRAWLER_SERVICE_AUTH_TOKEN') || 'secret',
          vsts: {
            collectionUrl: config.get('VSTS_BUILD_COLLECTION_URL') || 'https://clearlydefined.visualstudio.com/DefaultCollection',
            apiToken: config.get('VSTS_API_TOKEN'),
            project: config.get('VSTS_BUILD_PROJECT_NAME') || 'ClearlyDefined',
            definitionName: config.get('VSTS_BUILD_DEFINITION_NAME') || 'Run scancode (master)',
            emptyRepoUrl: config.get('VSTS_REPO') || 'https://clearlydefined.visualstudio.com/_git/ClearlyDefined',
            azureSubscriptionEndpoint: config.get('VSTS_AZURE_SUBSCRIPTION_ENDPOINT'),
            azureContainerRegistry: config.get('VSTS_AZURE_CONTAINER_REGISTRY')
          }
        }
      },
      source: {},
      top: {},
      vsts: {
        apiToken: config.get('VSTS_API_TOKEN')
      }
    },
    store: {
      dispatcher: config.get('CRAWLER_STORE_PROVIDER') || 'file',
      cdDispatch: {},
      webhook: {
        url: config.get('CRAWLER_WEBHOOK_URL') || 'http://localhost:4000/webhook',
        token: config.get('CRAWLER_WEBHOOK_TOKEN'),
      },
      azblob,
      file
    },
    deadletter: {
      provider: config.get('CRAWLER_DEADLETTER_PROVIDER') || config.get('CRAWLER_STORE_PROVIDER') || 'file',
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

