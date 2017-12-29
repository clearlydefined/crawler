// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const config = require('painless-config');

const clearlyDefined = {
  url: config.get('CRAWLER_STORE_URL'),
  token: config.get('CRAWLER_STORE_TOKEN')
};

const azblob = {
  connection: config.get('AZURE_BLOB_CONNECTION_STRING'),
  container: config.get('AZURE_BLOB_CONTAINER')
}

module.exports =
  {
    searchPath: [module],
    crawler: {
      count: 1
    },
    fetch: {
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
      npm: {},
      top: {}
    },
    store: {
      provider: 'azblob',
      clearlyDefined,
      azblob
    },
    deadletter: {
      provider: 'azblob',
      clearlyDefined,
      azblob
    },
    queue: {
      provider: 'memory',
      memory: {
        weights: { immediate: 3, soon: 2, normal: 3, later: 2 }
      }
    }
  };

