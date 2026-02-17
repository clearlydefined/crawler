// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const appInsights = require('applicationinsights')

/**
 * Module-level client reference. In applicationinsights 3.x, defaultClient is read-only,
 * so we maintain our own reference to the configured client.
 *
 * @type {Insights | import('applicationinsights').TelemetryClient | null}
 */
let _client = null

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

  /**
   * Gets the configured telemetry client. Returns the module-level client that was set up
   * via the setup() method.
   *
   * @returns {Insights | import('applicationinsights').TelemetryClient | null} The configured client or null if not set up
   */
  static getClient() {
    return _client
  }

  static setup(tattoos, connectionString = 'mock', echo = true) {
    // exit if we are already setup
    if (_client instanceof Insights) return
    if (!connectionString || connectionString === 'mock') {
      _client = new Insights(tattoos, null, echo)
    } else {
      appInsights.setup(connectionString).setAutoCollectPerformance(false).setAutoCollectDependencies(false).start()
      _client = new Insights(tattoos, appInsights.defaultClient, echo)
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
    const hasProperties = traceTelemetry.properties && Object.keys(traceTelemetry.properties).length > 0
    const propertyString = hasProperties ? ` ${JSON.stringify(traceTelemetry.properties)}` : ''
    const severity = traceTelemetry.severity
    const severityChar = severityMap[severity] || '?'
    if (this.client) this.client.trackTrace(traceTelemetry)
    if (this.echo) console.log(`[${severityChar}] ${traceTelemetry.message}${propertyString}`)
  }

  tattoo(telemetry) {
    telemetry.properties = { ...(telemetry.properties || {}), ...this.tattoos }
  }
}
module.exports = Insights
