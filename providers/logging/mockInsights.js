// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const appInsights = require('applicationinsights')

class MockInsights {
  constructor(client = null) {
    this.client = client
  }

  static setup(key = 'mock', echo = false) {
    // exit if we are already setup
    if (appInsights.defaultClient instanceof MockInsights) return
    if (!key || key === 'mock') appInsights.defaultClient = new MockInsights(null, echo)
    else {
      appInsights.setup(key).setAutoCollectPerformance(false).setAutoCollectDependencies(false).start()
      if (echo) appInsights.defaultClient = new MockInsights(appInsights.defaultClient)
    }
  }

  trackException(exceptionTelemetry) {
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
    const severities = ['V', 'I', 'W', 'E', 'C']
    const hasProperties = traceTelemetry.properties && Object.keys(traceTelemetry.properties).length > 0
    const propertyString = hasProperties ? `${JSON.stringify(traceTelemetry.properties)}` : ''
    console.log(`[${severities[traceTelemetry.severity]}] ${traceTelemetry.message} ${propertyString}`)
    if (this.client) this.client.trackTrace(traceTelemetry)
  }
}
module.exports = MockInsights
