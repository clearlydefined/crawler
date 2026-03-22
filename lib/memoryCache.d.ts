// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

declare class MemoryCache {
  defaultTtlSeconds: number

  constructor(options: { defaultTtlSeconds: number }, cache: any)

  get(item: string): any
  set(item: string, value: any, afterExpire?: (key: string, value: any) => void, ttlSeconds?: number): void
  setWithConditionalExpiry(
    item: string,
    value: any,
    afterExpire?: (key: string, value: any) => void,
    shouldExpire?: (key: string, value: any) => boolean
  ): void
  delete(item: string): void

  static create(options?: { defaultTtlSeconds: number }): MemoryCache
}

export = MemoryCache
