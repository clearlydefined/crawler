// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

declare const providers: {
  filter: Record<string, (...args: unknown[]) => unknown>
  fetch: Record<string, (...args: unknown[]) => unknown>
  process: Record<string, (...args: unknown[]) => unknown>
  store: Record<string, (...args: unknown[]) => unknown>
}

export = providers
