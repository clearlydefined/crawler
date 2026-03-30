// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

declare function createInsights(config: { get: (key: string) => unknown }): import('./insights')

export = createInsights
