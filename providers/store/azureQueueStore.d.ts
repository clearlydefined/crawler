import { DocStore } from '../../ghcrawler/types/docStore'
import { BaseHandlerOptions } from '../../lib/baseHandler'

declare function createAzureQueueStore(
  options: BaseHandlerOptions & { queueName: string; [key: string]: unknown }
): DocStore

export = createAzureQueueStore
