// Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-License-Identifier: MIT

const auth = require('./middleware/auth')
const bodyParser = require('body-parser')
const config = require('painless-config')
const express = require('express')
const morgan = require('morgan')
const sendHelper = require('./middleware/sendHelper')

function configureApp(service, logger) {
  process.on('unhandledRejection', exception => logger.error('unhandledRejection', exception))
  auth.initialize(config.get('CRAWLER_SERVICE_AUTH_TOKEN') || 'secret', config.get('CRAWLER_SERVICE_FORCE_AUTH'))

  const app = express()

  app.disable('x-powered-by')
  app.use(morgan('dev'))
  app.use(sendHelper())

  app.use(bodyParser.json({ limit: '2mb', strict: false }))
  app.use('/requests', require('./routes/requests')(service))

  // to keep AlwaysOn flooding logs with errors
  app.use('/', require('./routes/index')(config.get('BUILD_SHA'), config.get('APP_VERSION')))

  // Catch 404 and forward to error handler
  const requestHandler = (request, response, next) => {
    let error = new Error('404 - Not Found')
    error.status = 404
    error.success = false
    next(error)
  }
  app.use(requestHandler)

  // Hang the service init code off a route middleware.  Doesn't really matter which one.
  requestHandler.init = (app, callback) => {
    service.ensureInitialized().then(
      () => {
        service.run()
        console.log('Service initialized')
        // call the callback but with no args.  An arg indicates an error.
        callback()
      },
      error => {
        console.log(`Service initialization error: ${error.message}`)
        console.dir(error)
        callback(error)
      }
    )
  }

  // Error handlers
  const handler = (error, request, response, next) => {
    if (response.headersSent) return next(error)
    if (!(request && request.url && request.url.includes('robots933456.txt')))
      // https://feedback.azure.com/forums/169385-web-apps/suggestions/32120617-document-healthcheck-url-requirement-for-custom-co
      logger.error('SvcRequestFailure: ' + request.url, error)
    response.status(error.status || 500)
    let propertiesToSerialize = ['success', 'message']
    if (app.get('env') !== 'production') {
      propertiesToSerialize.push('stack')
    }
    // Properties on Error object aren't enumerable so need to explicitly list properties to serialize
    response.send(JSON.stringify(error, propertiesToSerialize))
    response.end()
  }
  app.use(handler)
  return app
}

module.exports = configureApp
