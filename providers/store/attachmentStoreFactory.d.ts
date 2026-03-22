import { DocStore } from '../../ghcrawler/lib/crawler'

declare function createAttachmentStoreFactory(
  realFactory: (options: Record<string, any>) => DocStore
): (options: Record<string, any>) => DocStore

export = createAttachmentStoreFactory
