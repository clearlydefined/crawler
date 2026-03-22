// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

/** A document stored in a DocStore, with at least a _metadata property. */
interface StoredDocument {
  _metadata: {
    type?: string
    url?: string
    etag?: string
    version?: string
    links?: { self?: { href: string; type: string }; [key: string]: unknown }
    fetchedAt?: string
    processedAt?: string
    extra?: Record<string, unknown>
    [key: string]: unknown
  }
  [key: string]: unknown
}

interface DocStore {
  connect(): Promise<void>
  upsert(document: StoredDocument): Promise<StoredDocument | string | void>
  get(type: string, key: string): Promise<StoredDocument>
  etag(type: string, key: string): Promise<string | null>
  list?(type: string): Promise<StoredDocument[]>
  delete?(type: string, key: string): Promise<boolean | void>
  count?(type: string): Promise<number>
  close(): void
}

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
