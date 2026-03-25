/**
 * Custom type definitions for painless-config package. These types override the incorrect types provided by the
 * package.
 *
 * @see https://github.com/microsoft/painless-config
 */

declare module 'painless-config' {
  /** Interface for the painless-config module functionality. */
  interface IPainlessConfig {
    /**
     * Gets a configuration value by name from environment variables or fallback file.
     *
     * @param name - The name of the configuration variable to retrieve
     * @returns The configuration value as a string, or undefined if not found
     */
    get(name: string): string | undefined

    /**
     * Gets all configuration values as a nested object. Environment variable names with underscores or hyphens are
     * converted to nested object paths.
     *
     * @returns A nested object containing all configuration values
     */
    all(): Record<string, any>
  }

  const config: IPainlessConfig

  export = config
}
