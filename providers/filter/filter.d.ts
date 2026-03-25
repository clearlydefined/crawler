import AbstractProcessor = require('../process/abstractProcessor')
import type { Handler } from '../../ghcrawler/lib/crawler'
import type { BaseHandlerOptions } from '../../lib/baseHandler'
import Request = require('../../ghcrawler/lib/request')
import EntitySpec = require('../../lib/entitySpec')

declare function createFilter(options: BaseHandlerOptions, processors: Handler[]): StandardFilter

declare class StandardFilter extends AbstractProcessor {
  processors: Handler[]

  shouldFetchMissing(request: Request): string | null
  shouldFetch(request: Request, spec?: EntitySpec): boolean
  shouldProcess(request: Request): boolean
}

export = createFilter
