// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const HashedContentStore = require('./hashedContentStore')

module.exports = realFactory => {
  return options => HashedContentStore({ ...options, baseStore: realFactory(options) })
}
