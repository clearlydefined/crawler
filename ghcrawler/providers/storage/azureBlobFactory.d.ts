// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import type { DocStore } from '../../types/docStore'

interface AzureBlobOptions {
  account: string
  connection?: string
  container: string
  logger: { info(message: string): void }
  spnAuth?: string
  isSpnAuth?: boolean | string
  useManagedIdentity?: boolean | string
  [key: string]: unknown
}

declare function createAzureBlobStore(options: AzureBlobOptions): DocStore

export = createAzureBlobStore
