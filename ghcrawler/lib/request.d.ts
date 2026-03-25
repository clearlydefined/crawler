// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import TraversalPolicy = require('./traversalPolicy')
import EntitySpec = require('../../lib/entitySpec')
import { DocumentMetadata } from '../types/docStore'

type ProcessControl = 'skip' | 'requeue' | 'defer'

interface Logger {
  log(level: string, message: string, meta?: Record<string, unknown>): void
}

interface RequestDocument {
  id?: string | number
  _metadata: DocumentMetadata
  [key: string]: any
}

interface RequestContext {
  history?: string[]
  qualifier?: string
  relation?: any
  [key: string]: any
}

interface RequestMeta {
  root?: string
  [key: string]: any
}

interface Crawler {
  queue(requests: Request | Request[], name?: string, scope?: string | null): Promise<void>[] | Promise<void>
  storeDeadletter(request: Request, message: string): Promise<void>
  queues: { defer(request: Request): void }
  logger: Logger
}

declare class Request {
  type: string
  url: string
  context: RequestContext
  policy: TraversalPolicy | string
  meta?: RequestMeta
  document?: RequestDocument
  payload?: any
  crawler?: Crawler
  start?: number
  promises?: Promise<void>[]
  cleanups?: (() => void)[]
  save?: boolean
  processControl?: ProcessControl
  outcome?: string
  message?: string
  contentOrigin?: string
  nextRequestTime?: number
  attemptCount?: number
  casedSpec?: EntitySpec

  constructor(type: string, url: string, context?: RequestContext | null)

  static adopt(object: Record<string, any>): Request
  static _getResolvedPolicy(request: Request): TraversalPolicy

  open(crawler: Crawler): this

  hasSeen(request: Request): boolean
  getTrackedPromises(): Promise<void>[]
  getTrackedCleanups(): (() => void)[]

  track(promises: Promise<void> | Promise<void>[] | null): this
  trackCleanup(cleanups: (() => void) | (() => void)[] | null): this
  removeCleanup(cleanups: (() => void) | (() => void)[] | null): this
  addMeta(data: Record<string, unknown>): this

  addRootSelfLink(id?: string | null): void
  addSelfLink(key?: string): void
  getRootQualifier(id?: string | null): string
  getChildQualifier(key?: string): string
  linkResource(name: string, urn: string | string[]): void
  linkSiblings(href: string): void
  linkCollection(name: string, href: string): void
  linkRelation(name: string, href: string): void

  getNextPolicy(name: string): TraversalPolicy | null
  queueRequests(requests: Request | Request[], name?: string | null, scope?: string | null): void
  queue(
    type: string,
    url: string,
    policy: TraversalPolicy | null,
    context?: RequestContext | null,
    pruneRelation?: boolean,
    scope?: string | null
  ): void

  markDead(outcome: string, message: string): this
  markSkip(outcome: string, message?: string): this
  markRequeue(outcome: string, message: string): this
  markDefer(outcome: string, message: string): this
  markSave(): this
  markNoSave(): this

  shouldSave(): boolean
  shouldSkip(): boolean
  isDeferred(): boolean
  shouldRequeue(): boolean

  delayUntil(time: number): void
  delay(milliseconds?: number): void

  createRequeuable(): Request
  toString(): string
  toUniqueString(): string
}

export = Request
