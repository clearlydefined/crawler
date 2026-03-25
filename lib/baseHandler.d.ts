// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import Request = require('../ghcrawler/lib/request')
import EntitySpec = require('./entitySpec')

interface BaseHandlerOptions {
  logger: import('../ghcrawler/lib/request').Logger
  [key: string]: unknown
}

interface TmpFileResult {
  name: string
  fd: number
  removeCallback: () => void
}

interface TmpDirResult {
  name: string
  removeCallback: () => void
}

interface FileHashes {
  sha1: string
  sha256: string
}

declare class BaseHandler {
  options: BaseHandlerOptions
  logger: BaseHandlerOptions['logger']

  constructor(options: BaseHandlerOptions)

  handle(request: Request): void
  get tmpOptions(): { unsafeCleanup: boolean; tmpdir: string; prefix: string }

  computeHashes(file: string | null): Promise<FileHashes | null>
  createTempFile(request: Request): TmpFileResult
  createTempDir(request: Request): TmpDirResult
  toSpec(request: Request): EntitySpec
  getLatestVersion(versions: string | string[]): string | null
  isPreReleaseVersion(version: string): boolean
  markSkip(request: Request): Request
}

export = BaseHandler
export type { BaseHandlerOptions, FileHashes, TmpDirResult, TmpFileResult }
