import { DocStore } from '../../ghcrawler/lib/crawler'
import { BaseHandlerOptions } from '../../lib/baseHandler'

declare function createAttachmentStore(options: BaseHandlerOptions & { baseStore: DocStore }): DocStore

export = createAttachmentStore
