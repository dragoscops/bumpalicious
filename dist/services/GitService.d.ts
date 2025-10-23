import type { GitHubService } from './GitHubService.js';
import type { GitTag, GitCommit, GitRef, GitComparison, CreateTagParams, CreateCommitParams, UpdateRefParams } from '../types/git.js';
import type { Result } from '../types/result.js';
import { GitOperationError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';
export declare class GitService extends Loggable {
    private readonly github;
    constructor(github: GitHubService);
    getRef(ref: string): Promise<Result<GitRef, GitOperationError>>;
    createTag(params: CreateTagParams): Promise<Result<GitTag, GitOperationError>>;
    createCommit(params: CreateCommitParams): Promise<Result<GitCommit, GitOperationError>>;
    updateRef(params: UpdateRefParams): Promise<Result<GitRef, GitOperationError>>;
    getChangedFiles(base: string, head: string, path?: string): Promise<Result<GitComparison, GitOperationError>>;
    getLastCommit(branch?: string): Promise<Result<{
        sha: string;
        message: string;
    } | null, GitOperationError>>;
    getLastTag(): Promise<Result<GitTag | null, GitOperationError>>;
    getCommitsSince(base: string, head?: string): Promise<Result<readonly GitCommit[], GitOperationError>>;
}
//# sourceMappingURL=GitService.d.ts.map