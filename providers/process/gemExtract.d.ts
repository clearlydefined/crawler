import AbstractProcessor = require("./abstractProcessor")

declare function createProcessor(
  options: Record<string, any>,
  sourceFinder?: (...args: any[]) => Promise<any>
): AbstractProcessor

export = createProcessor
