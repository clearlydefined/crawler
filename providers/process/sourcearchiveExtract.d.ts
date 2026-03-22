import AbstractProcessor = require('./abstractProcessor')
import type { BaseHandlerOptions } from '../../lib/baseHandler'

declare function createProcessor(options: BaseHandlerOptions): AbstractProcessor

export = createProcessor
