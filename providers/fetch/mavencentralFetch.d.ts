import AbstractFetch = require('./abstractFetch')
import type { BaseHandlerOptions } from '../../lib/baseHandler'

declare function createFetcher(options: BaseHandlerOptions): AbstractFetch

export = createFetcher
