// Copyright (c) Microsoft Corporation and others. Made available under the MIT license.
// SPDX-License-Identifier: MIT

import ScopedQueueSets = require('./scopedQueueSets')

declare function createStorageQueues(options: Record<string, unknown>): ScopedQueueSets

export = createStorageQueues
