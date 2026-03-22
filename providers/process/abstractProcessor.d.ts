// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import BaseHandler = require('../../lib/baseHandler')
import Request = require('../../ghcrawler/lib/request')
import EntitySpec = require('../../lib/entitySpec')
import { StoredDocument } from '../../ghcrawler/providers/storage/inmemoryDocStore'

declare class AbstractProcessor extends BaseHandler {
  get toolVersion(): string
  get configVersion(): string
  get toolName(): string

  aggregateVersions(versions: (string | undefined)[], errorRoot?: string): string

  attachFiles(document: StoredDocument, files: string[], location?: string): Promise<void>
  getFiles(location: string): Promise<string[]>
  getFolders(location: string, ignorePaths?: string[]): Promise<string[]>
  filterFiles(location: string): Promise<string[]>

  shouldFetch(request?: Request): boolean
  canHandle(request: Request): boolean
  shouldProcess(request: Request): boolean
  shouldTraverse(request: Request): boolean
  isProcessing(request: Request): boolean

  handle(request: Request): Request | Promise<Request>
  clone(document: StoredDocument): StoredDocument

  addSelfLink(request: Request, urn?: string | null): void
  addBasicToolLinks(request: Request, spec: EntitySpec): void
  getUrnFor(request: Request, spec?: EntitySpec | null): string
  linkAndQueue(request: Request, name: string, spec?: EntitySpec | null): void
  linkAndQueueTool(request: Request, name: string, tool?: string, scope?: string | null): void
  addLocalToolTasks(request: Request, ...tools: string[]): void
}

export = AbstractProcessor
