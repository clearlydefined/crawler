import { DocStore } from '../../ghcrawler/lib/crawler'

declare function createAttachmentStore(options: Record<string, any>): DocStore

export = createAttachmentStore
