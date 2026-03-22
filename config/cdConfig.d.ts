// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

interface CrawlerConfig {
  provider?: string
  searchPath?: NodeModule[]
  crawler: { count: number; maxRequeueAttemptCount?: number; [key: string]: unknown }
  filter?: Record<string, unknown>
  fetch: Record<string, unknown>
  process: Record<string, unknown>
  store: Record<string, unknown>
  deadletter: Record<string, unknown>
  queue: Record<string, unknown>
  lock?: Record<string, unknown>
}

declare const config: CrawlerConfig

export = config
export { CrawlerConfig };
