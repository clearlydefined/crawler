// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import AbstractProcessor = require('./abstractProcessor')
import Request = require('../../ghcrawler/lib/request')

declare class AbstractClearlyDefinedProcessor extends AbstractProcessor {
  handle(request: Request, location?: string, interestingRoot?: string): Promise<Request>
  clone(document: Record<string, any>): Record<string, any>
}

export = AbstractClearlyDefinedProcessor
