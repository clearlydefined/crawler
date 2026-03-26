// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import type { DocStore } from '../../types/docStore'

declare function createFileStore(options: { location: string; [key: string]: unknown }): DocStore

export = createFileStore
