import { DocStore } from '../../ghcrawler/lib/crawler'

declare function createStoreDispatcher(
  options: Record<string, any>,
  names: string[],
  stores: DocStore[]
): DocStore

export = createStoreDispatcher
