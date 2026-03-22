import AbstractProcessor = require('../process/abstractProcessor')
import { Handler } from '../../ghcrawler/lib/crawler'
import Request = require('../../ghcrawler/lib/request')

declare function createFilter(options: Record<string, any>, processors: Handler[]): StandardFilter

declare class StandardFilter extends AbstractProcessor {
  processors: Handler[]

  shouldFetchMissing(request: Request): string | null
  shouldFetch(request: Request, spec?: any): boolean
  shouldProcess(request: Request): boolean
}

export = createFilter
