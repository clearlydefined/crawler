// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import { CrawlQueue } from './nestedQueue'

declare function createWebhookQueue(
  manager: { createQueueChain(name: string, options: Record<string, unknown>): CrawlQueue },
  options: Record<string, unknown>
): CrawlQueue

export = createWebhookQueue
