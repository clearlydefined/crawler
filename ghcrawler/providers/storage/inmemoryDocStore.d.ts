// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

interface DocStore {
  connect(): Promise<void>
  upsert(document: Record<string, any>): Promise<any>
  get(type: string, key: string): Promise<Record<string, any>>
  etag(type: string, key: string): Promise<string | null>
  list?(type: string): Promise<Record<string, any>[]>
  delete?(type: string, key: string): Promise<boolean | void>
  count?(type: string): Promise<number>
  close(): void
}

declare class InmemoryDocStore implements DocStore {
  collections: Record<string, Record<string, any>>

  constructor()

  connect(): Promise<void>
  upsert(document: Record<string, any>): Promise<Record<string, any>>
  get(type: string, key: string): Promise<Record<string, any>>
  etag(type: string, key: string): Promise<string | null>
  list(type: string): Promise<Record<string, any>[]>
  delete(type: string, key: string): Promise<boolean | null>
  count(type: string): Promise<number>
  close(): void
}

declare function createInmemoryDocStore(options?: Record<string, unknown>): InmemoryDocStore

export = createInmemoryDocStore
export { DocStore, InmemoryDocStore }
