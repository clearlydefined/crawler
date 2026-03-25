import type { DocStore } from '../../ghcrawler/types/docStore'
import type { BaseHandlerOptions } from '../../lib/baseHandler'

declare function createAttachmentStore(options: BaseHandlerOptions & { baseStore: DocStore }): DocStore

export = createAttachmentStore
