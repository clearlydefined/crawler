// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import { DocStore, StoredDocument } from '../../types/docStore'

declare class InmemoryDocStore implements DocStore {
  collections: Record<string, Record<string, StoredDocument>>

  constructor()

  connect(): Promise<void>
  upsert(document: StoredDocument): Promise<StoredDocument>
  get(type: string, key: string): Promise<StoredDocument>
  etag(type: string, key: string): Promise<string | null>
  list(type: string): Promise<StoredDocument[]>
  delete(type: string, key: string): Promise<boolean | null>
  count(type: string): Promise<number>
  close(): void
}

declare function createInmemoryDocStore(options?: Record<string, unknown>): InmemoryDocStore

export = createInmemoryDocStore
export { DocStore, InmemoryDocStore, StoredDocument }
