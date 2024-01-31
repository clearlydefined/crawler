// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const AttachmentStore = require('./attachmentStore')

module.exports = realFactory => {
  return options => AttachmentStore({ ...options, baseStore: realFactory(options) })
}
