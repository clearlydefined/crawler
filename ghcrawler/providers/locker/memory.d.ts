// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import { Locker } from '../lib/crawler'

declare function createMemoryLocker(): Locker

export = createMemoryLocker
