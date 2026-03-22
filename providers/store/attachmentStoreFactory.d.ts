import { DocStore } from '../../ghcrawler/lib/crawler'
import { BaseHandlerOptions } from '../../lib/baseHandler'

declare function createAttachmentStoreFactory(
  realFactory: (options: BaseHandlerOptions) => DocStore
): (options: BaseHandlerOptions) => DocStore

export = createAttachmentStoreFactory
