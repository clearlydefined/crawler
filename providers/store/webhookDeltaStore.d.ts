import { DocStore } from '../../ghcrawler/lib/crawler'
import { BaseHandlerOptions } from '../../lib/baseHandler'

declare function createWebhookDeltaStore(options: BaseHandlerOptions & { url: string; token?: string }): DocStore

export = createWebhookDeltaStore
