// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { MapNode } from '../ghcrawler/lib/visitorMap'

interface VisitorMapScenario {
  self: Record<string, never>
  neighbors: () => Record<string, never>
  component: MapNode
  source: MapNode
  package: MapNode
  [key: string]: MapNode | (() => MapNode)
}

declare const maps: {
  default: VisitorMapScenario
}

export = maps
