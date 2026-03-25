// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import ScopedQueueSets = require('./scopedQueueSets')

declare function createMemoryQueues(options: Record<string, unknown>): ScopedQueueSets

export = createMemoryQueues
