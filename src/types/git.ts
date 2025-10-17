/**
 * Git operation type definitions
 */

/**
 * Git tag information
 */
export interface GitTag {
  readonly name: string;
  readonly sha: string;
  readonly message?: string;
}

/**
 * Git commit information
 */
export interface GitCommit {
  readonly sha: string;
  readonly message: string;
  readonly author: {
    readonly name: string;
    readonly email: string;
  };
  readonly date: string;
}

/**
 * Git tree object
 */
export interface GitTree {
  readonly sha: string;
  readonly url: string;
}

/**
 * Git reference (branch or tag)
 */
export interface GitRef {
  readonly ref: string;
  readonly sha: string;
}

/**
 * File change information
 */
export interface FileChange {
  readonly path: string;
  readonly status: 'added' | 'modified' | 'removed' | 'renamed';
  readonly additions: number;
  readonly deletions: number;
}

/**
 * Comparison between two commits
 */
export interface GitComparison {
  readonly base: string;
  readonly head: string;
  readonly files: ReadonlyArray<FileChange>;
  readonly commits: ReadonlyArray<GitCommit>;
}

/**
 * Tag creation parameters
 */
export interface CreateTagParams {
  readonly tagName: string;
  readonly message: string;
  readonly commitSha: string;
  readonly taggerName?: string;
  readonly taggerEmail?: string;
}

/**
 * Commit creation parameters
 */
export interface CreateCommitParams {
  readonly message: string;
  readonly tree: string;
  readonly parents: ReadonlyArray<string>;
  readonly author?: {
    readonly name: string;
    readonly email: string;
  };
}

/**
 * Branch update parameters
 */
export interface UpdateRefParams {
  readonly ref: string;
  readonly sha: string;
  readonly force?: boolean;
}
