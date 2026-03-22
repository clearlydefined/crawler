// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

declare const providers: {
  filter: Record<string, (...args: any[]) => any>
  fetch: Record<string, (...args: any[]) => any>
  process: Record<string, (...args: any[]) => any>
  store: Record<string, (...args: any[]) => any>
}

export = providers
