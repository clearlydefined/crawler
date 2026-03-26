// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import BaseHandler = require('../../lib/baseHandler')
import Request = require('../../ghcrawler/lib/request')

declare class AbstractFetch extends BaseHandler {
  handle(request: Request): Request | Promise<Request>
  canHandle(request: Request): boolean
  unzip(source: string, destination: string): Promise<void>
  decompress(source: string, destination: string): Promise<void>
}

export = AbstractFetch
