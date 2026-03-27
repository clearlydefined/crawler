// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const appInsights = require('applicationinsights')
const safeStringify = require('safe-stable-stringify')

/**
 * Mapping from KnownSeverityLevel string values to single-character abbreviations for console output.
 * In applicationinsights 3.x, severity is a string ('Verbose', 'Information', 'Warning', 'Error', 'Critical')
 * instead of a numeric enum.
 */
const severityMap = {
  Verbose: 'V',
  Information: 'I',
  Warning: 'W',
  Error: 'E',
  Critical: 'C'
}

class Insights {
  constructor(tattoos, client = null, echo = true) {
    this.client = client
    this.tattoos = tattoos
    this.echo = echo
  }

  static create(tattoos, connectionString = 'mock', echo = true) {
    if (!connectionString || connectionString === 'mock') {
      return new Insights(tattoos, null, echo)
    } else {
      appInsights
        .setup(connectionString)
        .setAutoCollectPerformance(false)
        .setAutoCollectDependencies(false)
        // We emit telemetry via our custom Winston transport; disable console auto-collection
        // to avoid duplicate traces with a reduced customProperties envelope.
        .setAutoCollectConsole(false, false)
        .start()
      return new Insights(tattoos, appInsights.defaultClient, echo)
    }
  }

  trackException(exceptionTelemetry) {
    this.tattoo(exceptionTelemetry)
    if (exceptionTelemetry.exception?._type) {
      exceptionTelemetry.properties.type = exceptionTelemetry.exception._type
      exceptionTelemetry.properties.url = exceptionTelemetry.exception._url
      exceptionTelemetry.properties.cid = exceptionTelemetry.exception._cid
    }
    if (this.client) {
      this.client.trackException(exceptionTelemetry)
    }
    if (this.echo) {
      console.log('trackException:')
      console.dir(exceptionTelemetry.exception)
    }
  }

  trackTrace(traceTelemetry) {
    this.tattoo(traceTelemetry)
    const hasProperties = traceTelemetry.properties && Object.keys(traceTelemetry.properties).length > 0
    const propertyString = hasProperties ? ` ${safeStringify(traceTelemetry.properties)}` : ''
    const severity = traceTelemetry.severity
    const severityChar = severityMap[severity] || '?'
    if (this.client) {
      this.client.trackTrace(traceTelemetry)
    }
    if (this.echo) {
      console.log(`[${severityChar}] ${traceTelemetry.message}${propertyString}`)
    }
  }

  tattoo(telemetry) {
    telemetry.properties = { ...(telemetry.properties || {}), ...this.tattoos }
  }
}
module.exports = Insights
