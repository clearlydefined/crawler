// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import VisitorMap = require('./visitorMap')
import Request = require('./request')

type FetchPolicy =
  | 'storageOnly'
  | 'originStorage'
  | 'originMutable'
  | 'storageOriginIfMissing'
  | 'mutables'
  | 'originOnly'
type FreshnessPolicy = 'always' | 'match' | 'version' | 'matchOrVersion' | number

declare class TraversalPolicy {
  fetch: FetchPolicy
  freshness: FreshnessPolicy
  map: VisitorMap

  constructor(fetch: FetchPolicy, freshness: FreshnessPolicy, map: VisitorMap | string)

  static adopt(object: Record<string, any>): TraversalPolicy
  static getPolicy(policySpec: string): TraversalPolicy | null
  static default(map: string | VisitorMap): TraversalPolicy
  static event(map: string | VisitorMap): TraversalPolicy
  static refresh(map: string | VisitorMap): TraversalPolicy
  static reload(map: string | VisitorMap): TraversalPolicy
  static reprocess(map: string | VisitorMap): TraversalPolicy
  static reprocessAndDiscover(map: string | VisitorMap): TraversalPolicy
  static reprocessAndUpdate(map: string | VisitorMap): TraversalPolicy
  static always(map: string | VisitorMap): TraversalPolicy
  static reprocessAlways(map: string | VisitorMap): TraversalPolicy
  static reharvestAlways(map: string | VisitorMap): TraversalPolicy
  static clone(policy: TraversalPolicy): TraversalPolicy

  getNextPolicy(name: string, map?: VisitorMap | null): TraversalPolicy | null
  getCurrentStep(): import('./visitorMap').MapNode
  shouldProcess(request: Request, version: number): boolean
  shouldTraverse(): boolean
  isImmutable(type: string): boolean
  initialFetch(request: Request): string
  shouldFetchMissing(request?: Request): string | null
  getShortForm(): string
}

export = TraversalPolicy
