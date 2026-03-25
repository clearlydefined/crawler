import type { DocStore } from '../../ghcrawler/types/docStore'
import type { BaseHandlerOptions } from '../../lib/baseHandler'

declare function createAttachmentStoreFactory(
  realFactory: (options: BaseHandlerOptions) => DocStore
): (options: BaseHandlerOptions) => DocStore

export = createAttachmentStoreFactory
