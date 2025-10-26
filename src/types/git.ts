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

/**
 * File content from repository
 */
export interface FileContent {
  readonly path: string;
  readonly content: string;
  readonly encoding: 'base64' | 'utf-8';
  readonly sha: string;
  readonly size: number;
}

/**
 * Parameters for getting file content
 */
export interface GetFileContentParams {
  readonly path: string;
  readonly ref?: string;
}

/**
 * Parameters for updating file content
 */
export interface UpdateFileParams {
  readonly path: string;
  readonly content: string;
  readonly message: string;
  readonly sha?: string;
  readonly branch?: string;
}

/**
 * File update response
 */
export interface FileUpdateResponse {
  readonly sha: string;
  readonly commit: {
    readonly sha: string;
    readonly message: string;
  };
}

export interface RepositoryInfo {
  readonly owner: string;
  readonly repo: string;
}
