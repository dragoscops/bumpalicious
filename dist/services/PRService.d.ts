import type { GitHubService } from './GitHubService.js';
import { type Result } from '../types/result.js';
import type { WorkspaceTree } from '../types/workspace.js';
import { GitHubAPIError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';
export interface CreatePRParams {
    readonly title: string;
    readonly body: string;
    readonly base: string;
    readonly head: string;
    readonly draft?: boolean;
}
export interface MergePRParams {
    readonly prNumber: number;
    readonly mergeMethod?: 'merge' | 'squash' | 'rebase';
    readonly commitTitle?: string;
    readonly commitMessage?: string;
}
export interface HasMergedParams {
    readonly prNumber: number;
    readonly timeout?: number;
    readonly interval?: number;
}
export interface ExistsPRParams {
    readonly base: string;
    readonly head: string;
}
export interface WaitForChecksParams {
    readonly prNumber: number;
    readonly timeout?: number;
    readonly interval?: number;
}
export interface ChecksStatusResult {
    readonly allPassed: boolean;
    readonly pending: boolean;
    readonly totalChecks: number;
    readonly passedChecks: number;
    readonly failedChecks: number;
    readonly mergeableState: string;
    readonly failedCheckNames?: string[];
}
export interface PRCreateResponse {
    readonly number: number;
    readonly htmlUrl: string;
    readonly state: string;
}
export interface PRMergeResponse {
    readonly merged: boolean;
    readonly sha: string;
    readonly message: string;
}
export interface PRExistsResponse {
    readonly exists: boolean;
    readonly number?: number;
    readonly state?: string;
}
export declare class PRService extends Loggable {
    private readonly github;
    constructor(github: GitHubService);
    create(params: CreatePRParams): Promise<Result<PRCreateResponse, GitHubAPIError>>;
    merge(params: MergePRParams): Promise<Result<PRMergeResponse, GitHubAPIError>>;
    hasMerged(params: HasMergedParams): Promise<Result<boolean, GitHubAPIError>>;
    exists(params: ExistsPRParams): Promise<Result<PRExistsResponse, GitHubAPIError>>;
    waitForChecks(params: WaitForChecksParams): Promise<Result<ChecksStatusResult, GitHubAPIError>>;
    static buildPRBody(tree: WorkspaceTree): string;
    private static formatWorkspaceNode;
}
//# sourceMappingURL=PRService.d.ts.map