const requestRetryWithDefaults = require('requestretry').defaults({ maxAttempts: 3, fullResponse: true })

module.exports = requestRetryWithDefaults