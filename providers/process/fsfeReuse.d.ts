import AbstractProcessor = require('./abstractProcessor')
import { BaseHandlerOptions } from '../../lib/baseHandler'

declare function createProcessor(options: BaseHandlerOptions): AbstractProcessor

export = createProcessor
