// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import SourceSpec = require('./sourceSpec')

interface DiscoveryOptions {
  githubToken?: string
  logger?: { error(...args: any[]): void; [key: string]: any }
  [key: string]: any
}

declare function searchForRevisions(
  version: string,
  candidateUrls: string[],
  options: DiscoveryOptions
): Promise<SourceSpec | null>

export = searchForRevisions
