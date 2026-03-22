// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import { DocStore } from '../lib/crawler';

declare function createFileStore(options: { location: string; [key: string]: unknown }): DocStore

export = createFileStore
