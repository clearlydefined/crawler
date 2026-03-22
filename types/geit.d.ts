// Type definitions for geit
// Project: https://github.com/nicola/geit

declare module 'geit' {
  /** A node in a Git tree. Leaf nodes have `object` (blob SHA); directory nodes have `children`. */
  interface GeitTreeNode {
    /** Blob SHA for leaf nodes */
    object?: string
    /** Child nodes keyed by path segment */
    children?: Record<string, GeitTreeNode>
  }

  /** A lightweight Git client that operates over HTTP against a remote repository. */
  interface GeitClient {
    /** Fetch all refs from the remote. Returns a map of ref name → SHA. */
    refs(): Promise<Record<string, string>>

    /** Fetch a blob by its SHA. Returns the raw content as a Buffer. */
    blob(sha: string): Promise<Buffer>

    /**
     * Fetch the full tree for the given ref (branch, tag, or arbitrary ref).
     * Returns a recursive tree structure.
     */
    tree(ref: string): Promise<GeitTreeNode>
  }

  /**
   * Creates a new Git client for the given repository URL.
   *
   * @param repoUrl - HTTPS URL of the Git repository (e.g. `https://github.com/owner/repo.git`)
   * @returns A client with `refs`, `blob`, and `tree` methods
   */
  function geit(repoUrl: string): GeitClient

  export = geit
}
