// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { NextFunction, Request, Response } from 'express';

export function initialize(tokenValue: string, forceValue?: boolean): void
export function validate(request: Request, response: Response, next: NextFunction): void
