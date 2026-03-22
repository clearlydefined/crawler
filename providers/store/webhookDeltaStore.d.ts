import { DocStore } from '../../ghcrawler/lib/crawler'

declare function createWebhookDeltaStore(options: Record<string, any>): DocStore

export = createWebhookDeltaStore
