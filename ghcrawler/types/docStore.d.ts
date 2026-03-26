// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

/** Metadata attached to stored documents and request documents. */
interface DocumentMetadata {
  type?: string
  url?: string
  etag?: string
  version?: string | number
  links?: Record<string, { href?: string; hrefs?: string[]; type: string }>
  fetchedAt?: string
  processedAt?: string
  extra?: Record<string, unknown>
  [key: string]: unknown
}

/** A document stored in a DocStore, with at least a _metadata property. */
interface StoredDocument {
  _metadata: DocumentMetadata
  [key: string]: unknown
}

interface DocStore {
  connect(): Promise<void>
  upsert(document: StoredDocument): Promise<StoredDocument | string | undefined>
  get(type: string, key: string): Promise<StoredDocument>
  etag(type: string, key: string): Promise<string | null>
  list?(type: string): Promise<StoredDocument[]>
  delete?(type: string, key: string): Promise<boolean | undefined>
  count?(type: string): Promise<number>
  close(): void
}

export type { DocStore, DocumentMetadata, StoredDocument }
