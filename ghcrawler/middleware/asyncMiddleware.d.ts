// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { NextFunction, Request, Response } from 'express'

declare function asyncMiddleware(
  func: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => Promise<void>

export = asyncMiddleware
