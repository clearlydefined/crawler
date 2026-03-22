import AbstractFetch = require("./abstractFetch")
import { BaseHandlerOptions } from "../../lib/baseHandler"

declare function createFetcher(options: BaseHandlerOptions): AbstractFetch

export = createFetcher
