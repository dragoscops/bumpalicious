import type { GitHub } from '@actions/github/lib/utils.js';
import { Loggable } from '../utils/Loggable.js';
import { type RetryOptions } from '../utils/retry.js';
export interface RepositoryContext {
    readonly owner: string;
    readonly repo: string;
}
export interface GitHubServiceConfig {
    readonly repository: RepositoryContext;
    readonly retryOptions?: Partial<RetryOptions>;
}
export type OctokitInstance = InstanceType<typeof GitHub>;
export declare class GitHubService extends Loggable {
    private readonly octokit;
    private readonly repository;
    private readonly retryOptions;
    constructor(token: string, config: GitHubServiceConfig);
    getOctokit(): OctokitInstance;
    getRepository(): RepositoryContext;
    executeWithRetry<T>(operationName: string, operation: (octokit: OctokitInstance) => Promise<T>): Promise<T>;
    deleteBranch(branchName: string): Promise<void>;
    getRateLimit(): Promise<{
        limit: number;
        remaining: number;
        reset: number;
        used: number;
    }>;
    checkRateLimit(threshold?: number): Promise<boolean>;
    private waitForRateLimitReset;
    private executeOperation;
    private handleOperationError;
    private wrapGitHubError;
    private wrapDeleteBranchError;
    private extractStatusCode;
}
//# sourceMappingURL=GitHubService.d.ts.map