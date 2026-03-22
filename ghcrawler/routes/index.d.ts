// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Router } from 'express'

declare function setup(buildsha: string, appVersion: string): Router

export = setup
