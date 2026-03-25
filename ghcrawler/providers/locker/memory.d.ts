// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import type { Locker } from '../lib/crawler'

declare function createMemoryLocker(): Locker

export = createMemoryLocker
