// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import winston = require('winston')

interface TelemetryClient {
  trackTrace(traceTelemetry: { message: string; severity: string; properties?: Record<string, string> }): void
  trackException(exceptionTelemetry: { exception: Error; properties?: Record<string, string> }): void
  readonly echo: boolean
}

declare function factory(options?: { aiClient?: TelemetryClient; level?: string }): winston.Logger

export = factory
