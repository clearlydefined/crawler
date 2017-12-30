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

const file = {
  location: config.get('FILE_STORE_LOCATION') || process.platform === 'win32' ? 'c:/temp/cd' : '/tmp/cd'
};

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
      npm: {
        githubToken: config.get('CRAWLER_GITHUB_TOKEN')
      },
      top: {}
    },
    store: {
      provider: 'file',
      clearlyDefined,
      azblob,
      file
    },
    deadletter: {
      provider: 'file',
      clearlyDefined,
      azblob,
      file
    },
    queue: {
      provider: 'memory',
      memory: {
        weights: { immediate: 3, soon: 2, normal: 3, later: 2 }
      }
    }
  };

