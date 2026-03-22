import AbstractFetch = require("./abstractFetch")

declare function createFetcher(options: Record<string, any>): AbstractFetch

export = createFetcher
