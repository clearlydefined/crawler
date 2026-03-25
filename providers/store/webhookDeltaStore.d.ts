import type { DocStore } from '../../ghcrawler/types/docStore'
import type { BaseHandlerOptions } from '../../lib/baseHandler'

declare function createWebhookDeltaStore(options: BaseHandlerOptions & { url: string; token?: string }): DocStore

export = createWebhookDeltaStore
