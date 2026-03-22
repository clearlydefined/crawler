// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ContainerClient } from '@azure/storage-blob'
import { DocStore } from '../../lib/crawler'

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
  upsert(document: import('../../providers/storage/inmemoryDocStore').StoredDocument): Promise<string>
  get(type: string, key: string): Promise<import('../../providers/storage/inmemoryDocStore').StoredDocument>
  etag(type: string, key: string): Promise<string>
  list(type: string): Promise<import('../../providers/storage/inmemoryDocStore').StoredDocument[]>
  delete(type: string, key: string): Promise<void>
  count(type: string, force?: boolean): Promise<number>
  close(): Promise<void>
}

export = AzureStorageDocStore
