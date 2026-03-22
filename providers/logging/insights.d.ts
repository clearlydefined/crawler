declare class Insights {
  tattoos: Record<string, string>
  client: import('applicationinsights').TelemetryClient | null
  echo: boolean

  constructor(
    tattoos: Record<string, string>,
    client?: import('applicationinsights').TelemetryClient | null,
    echo?: boolean
  )

  static getClient(): Insights | null
  static setup(tattoos: Record<string, string>, connectionString?: string, echo?: boolean): void

  trackException(exceptionTelemetry: { exception: Error; properties?: Record<string, string> }): void
  trackTrace(traceTelemetry: { message: string; severity: string; properties?: Record<string, string> }): void
  tattoo(telemetry: { properties?: Record<string, string> }): void
}

export = Insights
