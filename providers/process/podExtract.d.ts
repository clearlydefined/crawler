import AbstractProcessor = require('./abstractProcessor')
import SourceSpec = require('../../lib/sourceSpec')
import type { BaseHandlerOptions } from '../../lib/baseHandler'

declare function createProcessor(
  options: BaseHandlerOptions,
  sourceFinder?: (version: string, candidates: string[], options: Record<string, unknown>) => Promise<SourceSpec | null>
): AbstractProcessor

export = createProcessor
