// Copyright (c) Microsoft Corporation and others. Made available under the MIT license.
// SPDX-License-Identifier: MIT

import ScopedQueueSets = require('./queuing/scopedQueueSets')
import type { Locker } from '../lib/crawler'
import type { DocStore } from '../types/docStore'

declare const providers: {
  queue: {
    storageQueue: (options: Record<string, unknown>) => ScopedQueueSets
    memory: (options: Record<string, unknown>) => ScopedQueueSets
  }
  store: {
    memory: (options?: Record<string, unknown>) => DocStore
    file: (options: { location: string; [key: string]: unknown }) => DocStore
    azblob: (options: Record<string, unknown>) => DocStore
  }
  lock: {
    memory: () => Locker
  }
}

export = providers
