// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const config = require('painless-config')
const defaults = require(config.get('CRAWLER_OPTIONS') || './config/cdConfig')
const run = require('./ghcrawler').run
const www = require('./ghcrawler/bin/www')
const createInsights = require('./providers/logging/insightsConfig')
const createLogger = require('./providers/logging/logger')
const { withTimeout } = require('./lib/utils')
const searchPath = [require('./providers')]
const maps = require('./config/map')

const shutdownTimeoutMs = defaults.crawler?.shutdownTimeoutMs ?? 60000

const aiClient = createInsights(config)
const logger = createLogger({ aiClient })

const service = run(defaults, logger, searchPath, maps)
const { server, port } = www(service, logger)

let shuttingDown = false

server.on('error', onError)

process.on('SIGTERM', onShutdown)
process.on('SIGINT', onShutdown)
process.on('SIGHUP', onShutdown)

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error
  }

  const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`)
      process.exit(1)
      break
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`)
      process.exit(1)
      break
    default:
      throw error
  }
}

async function onShutdown(signal) {
  if (shuttingDown) {
    return
  }
  shuttingDown = true
  console.log(`Received ${signal}`)

  try {
    await withTimeout(performShutdownCleanup, shutdownTimeoutMs)
    console.log('Server closed.')
    process.exit(0)
  } catch (error) {
    console.error(`Closing server: ${error}`)
    process.exit(1)
  }
}

async function performShutdownCleanup() {
  await closeServer(server)
  await service.stop()
  try {
    await aiClient.flush()
  } catch (error) {
    // Best effort to flush any remaining insights, but don't let it block shutdown.
    console.error(`Flushing insights: ${error}`)
  }
}

async function closeServer(httpServer) {
  await new Promise((resolve, reject) => {
    httpServer.close(error => {
      if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
        reject(error)
        return
      }
      resolve()
    })
  })
}
