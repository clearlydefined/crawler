// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { ContainerClient } from '@azure/storage-blob'
import type { DocStore, StoredDocument } from '../../types/docStore'

interface AzureStorageDocStoreOptions {
  container: string
  blobKey?: 'url' | 'urn'
  preserveCase?: boolean
  [key: string]: unknown
}

declare class AzureStorageDocStore implements DocStore {
  containerClient: ContainerClient
  options: AzureStorageDocStoreOptions

  constructor(containerClient: ContainerClient, options: AzureStorageDocStoreOptions)

  connect(): Promise<void>
  upsert(document: StoredDocument): Promise<string>
  get(type: string, key: string): Promise<StoredDocument>
  etag(type: string, key: string): Promise<string>
  list(type: string): Promise<StoredDocument[]>
  delete(type: string, key: string): Promise<void>
  count(type: string, force?: boolean): Promise<number>
  close(): Promise<void>
}

export = AzureStorageDocStore
