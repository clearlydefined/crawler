import AbstractProcessor = require('./abstractProcessor')
import type { BaseHandlerOptions } from '../../lib/baseHandler'

export function processor(options: BaseHandlerOptions): AbstractProcessor
export const supportedTypes: string[]
