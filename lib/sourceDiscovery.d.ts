// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import SourceSpec = require('./sourceSpec')

interface DiscoveryOptions {
  githubToken?: string
  logger?: { error(...args: unknown[]): void }
  [key: string]: unknown
}

declare function searchForRevisions(
  version: string,
  candidateUrls: string[],
  options: DiscoveryOptions
): Promise<SourceSpec | null>

export = searchForRevisions
