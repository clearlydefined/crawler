import { DocStore } from '../../ghcrawler/lib/crawler';
import { BaseHandlerOptions } from '../../lib/baseHandler';

declare function createAzureQueueStore(options: BaseHandlerOptions & { queueName: string; [key: string]: unknown }): DocStore

export = createAzureQueueStore
