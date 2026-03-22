// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

import Request = require('../../lib/request')
import NestedQueue = require('./nestedQueue')
import type { CrawlQueue } from './nestedQueue'

interface AttenuatedQueueOptions {
  parallelPush?: number
  attenuation?: { ttl?: number }
  logger: { verbose(message: string): void; silly?(message: string): void; [key: string]: unknown }
  [key: string]: unknown
}

declare class AttenuatedQueue extends NestedQueue {
  options: AttenuatedQueueOptions
  logger: AttenuatedQueueOptions['logger']

  constructor(queue: CrawlQueue, options: AttenuatedQueueOptions)

  done(request: Request): Promise<void>
  push(requests: Request | Request[]): Promise<void[]>
}

export = AttenuatedQueue
