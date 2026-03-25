import { DocStore } from '../../ghcrawler/types/docStore'
import { BaseHandlerOptions } from '../../lib/baseHandler'

declare function createAttachmentStore(options: BaseHandlerOptions & { baseStore: DocStore }): DocStore

export = createAttachmentStore
