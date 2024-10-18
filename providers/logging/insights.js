// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const appInsights = require('applicationinsights')

class Insights {
  constructor(options, client = null, echo = false) {
    this.client = client
    this.options = options
    this.echo = echo
  }

  static setup(options, key = 'mock', echo = false) {
    // exit if we are already setup
    if (appInsights.defaultClient instanceof Insights) return
    if (!key || key === 'mock') appInsights.defaultClient = new Insights(options, null, echo)
    else {
      appInsights.setup(key).setAutoCollectPerformance(false).setAutoCollectDependencies(false).start()
      appInsights.defaultClient = new Insights(options, appInsights.defaultClient, echo)
    }
  }

  trackException(exceptionTelemetry) {
    this.tattoo(exceptionTelemetry)
    if (exceptionTelemetry.exception && exceptionTelemetry.exception._type) {
      exceptionTelemetry.properties.type = exceptionTelemetry.exception._type
      exceptionTelemetry.properties.url = exceptionTelemetry.exception._url
      exceptionTelemetry.properties.cid = exceptionTelemetry.exception._cid
    }
    if (this.client) this.client.trackException(exceptionTelemetry)
    if (this.echo) {
      console.log('trackException:')
      console.dir(exceptionTelemetry.exception)
    }
  }

  trackTrace(traceTelemetry) {
    this.tattoo(traceTelemetry)
    const severities = ['V', 'I', 'W', 'E', 'C']
    const propertyString = JSON.stringify(traceTelemetry.properties)
    if (this.client) this.client.trackTrace(traceTelemetry)
    if (this.echo) console.log(`[${severities[traceTelemetry.severity]}] ${traceTelemetry.message} ${propertyString}`)
  }

  tattoo(telemetry) {
    telemetry.properties = { ...(telemetry.properties || {}), ...this.options }
  }
}
module.exports = Insights
