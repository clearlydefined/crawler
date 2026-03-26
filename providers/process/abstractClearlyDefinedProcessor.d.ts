// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import AbstractProcessor = require('./abstractProcessor')
import Request = require('../../ghcrawler/lib/request')

import type { StoredDocument } from '../../ghcrawler/types/docStore'

declare class AbstractClearlyDefinedProcessor extends AbstractProcessor {
  handle(request: Request, location?: string, interestingRoot?: string): Promise<Request>
  clone(document: StoredDocument): StoredDocument
}

export = AbstractClearlyDefinedProcessor
