// (c) Copyright 2022, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import Request = require('../ghcrawler/lib/request')

declare class FetchResult {
  contentOrigin: string
  url?: string
  readonly _cleanups: (() => void)[]
  readonly _meta: Record<string, any>
  _dependents: any[];
  [key: string]: any

  constructor(url?: string)

  trackCleanup(cleanups: (() => void) | (() => void)[]): this
  adoptCleanup(
    needCleanup: { removeCallback?: () => void } | { removeCallback?: () => void }[],
    fromRequest?: Request
  ): this
  cleanup(errorHandler?: (error: Error) => void): void

  addMeta(data: Record<string, any>): this
  copyTo(request: Request): void

  trackDependents(...dependents: any[]): this
  removeDependents(...toRemove: any[]): this
  isInUse(): boolean
  decorate(request: Request): void
}

export = FetchResult
