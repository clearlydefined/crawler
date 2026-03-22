// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

type MapNode = string | ((...args: any[]) => any) | MapNode[] | { [key: string]: MapNode }

declare class VisitorMap {
  name: string
  path: string

  constructor(name: string, path?: string)

  static register(name: string, value: MapNode): void
  static getCopy(name: string): MapNode
  static copy(node: MapNode, seen?: Map<any, any>): MapNode
  static resolve(step: MapNode, segment: string): MapNode | undefined
  static getMap(name: string, path?: string): VisitorMap | null

  getNextMap(next: string): VisitorMap | null
  getNextStep(next: string): MapNode | undefined
  hasNextStep(next?: string | null): boolean
  getCurrentStep(): MapNode
  navigate(map: MapNode, path: string | string[]): MapNode | undefined
  getMap(): MapNode
  getPath(): string[]
}

export = VisitorMap
