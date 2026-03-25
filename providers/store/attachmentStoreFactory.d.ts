import { DocStore } from '../../ghcrawler/types/docStore'
import { BaseHandlerOptions } from '../../lib/baseHandler'

declare function createAttachmentStoreFactory(
  realFactory: (options: BaseHandlerOptions) => DocStore
): (options: BaseHandlerOptions) => DocStore

export = createAttachmentStoreFactory
