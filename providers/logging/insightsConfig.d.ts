interface InsightsContext {
  aiClient: import('./insights')
  echo: boolean
}

declare function createInsightsContext(config: { get: (key: string) => unknown }): InsightsContext

export = createInsightsContext
