// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { CacheClass } from 'memory-cache'

declare class MemoryCache {
  defaultTtlSeconds: number

  constructor(options: { defaultTtlSeconds: number }, cache: CacheClass<string, unknown>)

  get(item: string): unknown
  set(item: string, value: unknown, afterExpire?: (key: string, value: unknown) => void, ttlSeconds?: number): void
  setWithConditionalExpiry(
    item: string,
    value: unknown,
    afterExpire?: (key: string, value: unknown) => void,
    shouldExpire?: (key: string, value: unknown) => boolean
  ): void
  delete(item: string): void

  static create(options?: { defaultTtlSeconds: number }): MemoryCache
}

export = MemoryCache
