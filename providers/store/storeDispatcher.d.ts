import type { DocStore } from '../../ghcrawler/types/docStore'
import type { BaseHandlerOptions } from '../../lib/baseHandler'

declare function createStoreDispatcher(options: BaseHandlerOptions, names: string[], stores: DocStore[]): DocStore

export = createStoreDispatcher
