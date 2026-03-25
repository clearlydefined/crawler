// Type definitions for throat (CommonJS compatible override)
// The built-in types use `export default` which doesn't work with require()

declare module 'throat' {
  /**
   * Throttle function to limit parallel executions
   */
  function throat<TResult, TArgs extends any[]>(
    size: number,
    fn: (...args: TArgs) => Promise<TResult>
  ): (...args: TArgs) => Promise<TResult>

  function throat<TResult, TArgs extends any[]>(
    fn: (...args: TArgs) => Promise<TResult>,
    size: number
  ): (...args: TArgs) => Promise<TResult>

  function throat(
    size: number
  ): <TResult, TArgs extends any[] = []>(fn: (...args: TArgs) => Promise<TResult>, ...args: TArgs) => Promise<TResult>

  export = throat
}
