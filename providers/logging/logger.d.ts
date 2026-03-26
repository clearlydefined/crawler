import winston = require('winston')

declare function factory(tattoos: Record<string, string>): winston.Logger

export = factory
