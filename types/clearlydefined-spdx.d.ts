/**
 * TypeScript type definitions for @clearlydefined/spdx package
 *
 * This module provides utilities for parsing, normalizing, and manipulating SPDX license expressions. It supports
 * operations like parsing expressions into ASTs, converting back to strings, checking license satisfaction, and merging
 * license expressions.
 */

declare module '@clearlydefined/spdx' {
  /** Represents a parsed SPDX license expression as an Abstract Syntax Tree (AST) */
  interface SpdxExpression {
    /** The SPDX license identifier (e.g., 'MIT', 'Apache-2.0') */
    license?: string
    /** Whether the license allows later versions (indicated by '+' suffix) */
    plus?: boolean
    /** License exception identifier (e.g., 'Classpath-exception-2.0') */
    exception?: string
    /** Logical conjunction operator ('and' or 'or') */
    conjunction?: 'and' | 'or'
    /** Left operand in a binary expression */
    left?: SpdxExpression
    /** Right operand in a binary expression */
    right?: SpdxExpression
    /** Indicates this is a NOASSERTION expression */
    noassertion?: boolean
  }

  /**
   * Visitor function type for processing license nodes during parsing
   *
   * @param license - The license identifier to process
   * @returns The normalized license identifier or null if invalid
   */
  type LicenseVisitor = (license: string) => string | null

  /**
   * Lookup function type for resolving license references
   *
   * @param licenseRef - The license reference to resolve
   * @returns The resolved license identifier or null if not found
   */
  type LicenseRefLookup = (licenseRef: string) => string | null

  /** Mode for merging license expressions */
  type MergeMode = 'OR' | 'AND'

  /**
   * Parses an SPDX expression into an Abstract Syntax Tree (AST) and corrects each node
   *
   * @param expression - SPDX expression string to parse
   * @param licenseVisitor - Optional visitor function to clean each license node
   * @param licenseRefLookup - Optional lookup function to resolve license references
   * @returns The AST representing the parsed expression
   */
  function parse(
    expression: string | SpdxExpression,
    licenseVisitor?: LicenseVisitor,
    licenseRefLookup?: LicenseRefLookup
  ): SpdxExpression

  /**
   * Converts a parsed expression AST back into an SPDX expression string
   *
   * @param obj - An AST representing the parsed expression
   * @returns The SPDX expression string
   */
  function stringify(obj: SpdxExpression): string

  /**
   * Normalizes and returns back a given SPDX expression. Corrects case and formatting inconsistencies.
   *
   * @param expression - SPDX expression to normalize
   * @returns The normalized SPDX expression or null if invalid/empty
   */
  function normalize(expression: string): string | null

  /**
   * Normalizes and returns back a single SPDX license identifier
   *
   * @param license - Single license identifier to normalize
   * @returns The normalized SPDX license identifier or null if invalid
   */
  function normalizeSingle(license: string): string | null

  /**
   * Checks if the first expression satisfies the second expression
   *
   * @param expression1 - First SPDX expression
   * @param expression2 - Second SPDX expression to check against
   * @returns True if expression1 satisfies expression2
   */
  function satisfies(expression1: string, expression2: string): boolean

  /**
   * Looks up an SPDX identifier by the full license name. Case insensitive matching.
   *
   * @param licenseName - Full name of the license
   * @returns SPDX identifier or null if not found
   */
  function lookupByName(licenseName: string): string | null

  /**
   * Merges the proposed expression into the base expression
   *
   * @param proposed - The proposed license expression to merge
   * @param base - The base license expression to merge into
   * @param mode - Merge mode, either 'OR' (default) or 'AND'
   * @returns The merged license expression
   */
  function merge(proposed: string | SpdxExpression, base: string | SpdxExpression, mode?: MergeMode): string

  /**
   * Expands the given expression into an equivalent array where each member is an array of licenses AND'd together and
   * the members are OR'd together
   *
   * @param expression - An SPDX license expression in string or object form
   * @returns The normalized list of license expression leaves equivalent to the input
   */
  function expand(expression: string | SpdxExpression): string[][]

  /**
   * Flattens the given expression into an array of all licenses mentioned in the expression
   *
   * @param expression - An SPDX license expression in string or object form
   * @returns An array of all license identifiers in the expression
   */
  function flatten(expression: string | SpdxExpression): string[]
}
