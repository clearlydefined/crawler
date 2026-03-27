import winston = require('winston')

declare function factory(options?: {
  aiClient?: {
    trackTrace: (traceTelemetry: { message: string; severity: string; properties?: Record<string, string> }) => void
    trackException: (exceptionTelemetry: { exception: Error; properties?: Record<string, string> }) => void
  }
  echo?: boolean
  level?: string
}): winston.Logger

export = factory
