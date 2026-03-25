// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

declare class EntitySpec {
  type: string
  provider: string
  namespace: string | null
  name: string
  revision: string | null
  tool: string | null
  toolVersion: string | null

  constructor(
    type: string,
    provider: string,
    namespace: string,
    name: string,
    revision?: string | null,
    tool?: string | null,
    toolVersion?: string | null
  )

  static fromUrl(url: string): EntitySpec | null
  static fromObject(spec: Partial<EntitySpec> | null): EntitySpec | null

  toUrn(): string
  toUrl(): string
  toUrlPath(): string
}

export = EntitySpec
