declare class Insights {
  tattoos: Record<string, string>
  client: import('applicationinsights').TelemetryClient | null
  echo: boolean

  constructor(
    tattoos: Record<string, string>,
    client?: import('applicationinsights').TelemetryClient | null,
    echo?: boolean
  )

  static create(tattoos: Record<string, string>, connectionString?: string, echo?: boolean): Insights

  trackException(exceptionTelemetry: { exception: Error; properties?: Record<string, string> }): void
  trackTrace(traceTelemetry: { message: string; severity: string; properties?: Record<string, string> }): void
  tattoo(telemetry: { properties?: Record<string, string> }): void
}

export = Insights
