import AbstractProcessor = require("./abstractProcessor")

declare function createProcessor(options: Record<string, any>): AbstractProcessor

export = createProcessor
