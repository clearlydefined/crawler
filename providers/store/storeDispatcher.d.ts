import { DocStore } from '../../ghcrawler/lib/crawler'
import { BaseHandlerOptions } from '../../lib/baseHandler'

declare function createStoreDispatcher(
  options: BaseHandlerOptions,
  names: string[],
  stores: DocStore[]
): DocStore

export = createStoreDispatcher
