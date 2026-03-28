// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const appFactory = require('../app')
const config = require('painless-config')
const http = require('node:http')
const init = require('express-init')

function run(service, logger) {
  /**
   * Get port from environment and store in Express.
   */
  let port = normalizePort(config.get('CRAWLER_SERVICE_PORT') || process.env.PORT || '5000')
  port = port === 'random' ? null : port

  const app = appFactory(service, logger)
  app.set('port', port)

  const server = http.createServer(app)

  // initialize the apps (if they have async init functions) and start listening
  init(app, error => {
    if (error) {
      console.log(`Error initializing the Express app: ${error}`)
      throw new Error(error)
    }
    server.listen(port)
  })

  server.on('listening', onListening)

  /**
   * Normalize a port into a number, string, or false.
   */

  function normalizePort(val) {
    const normalizedPort = Number.parseInt(val, 10)

    if (Number.isNaN(normalizedPort)) {
      // named pipe
      return val
    }

    if (normalizedPort >= 0) {
      // port number
      return normalizedPort
    }

    return false
  }

  /**
   * Event listener for HTTP server 'listening' event.
   */
  function onListening() {
    const addr = server.address()
    const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`
    console.log(`Crawler service listening on ${bind}`)
  }

  return { server, port }
}

module.exports = run
