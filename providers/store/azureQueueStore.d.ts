import { DocStore } from '../../ghcrawler/lib/crawler'

declare function createAzureQueueStore(options: Record<string, any>): DocStore

export = createAzureQueueStore
