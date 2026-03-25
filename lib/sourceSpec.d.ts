// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import EntitySpec = require('./entitySpec')

declare class SourceSpec {
  type: string
  provider: string
  namespace?: string
  name: string
  revision: string | null
  url: string | null
  path: string | null

  constructor(
    type: string,
    provider: string,
    namespace: string,
    name: string,
    revision?: string | null,
    url?: string | null,
    path?: string | null
  )

  static fromObject(spec: Partial<SourceSpec> | null): SourceSpec | null

  toEntitySpec(): EntitySpec
  toUrn(): string
  toUrl(): string | null
}

export = SourceSpec
