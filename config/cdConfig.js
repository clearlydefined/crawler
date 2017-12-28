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
      scancode: {},
      npm: {}
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

