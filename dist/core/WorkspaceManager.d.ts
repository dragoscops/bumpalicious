import type { ChangelogService } from './ChangelogService.js';
import type { VersionService } from './VersionService.js';
import type { WorkspaceTreeBuilder } from './WorkspaceTreeBuilder.js';
import type { GitHubService } from '../services/GitHubService.js';
import type { GitService } from '../services/GitService.js';
import { PRService } from '../services/PRService.js';
import type { Result } from '../types/result.js';
import type { WorkspaceConfig, Workspace, WorkspaceWithVersion, WorkspaceTree } from '../types/workspace.js';
import { WorkspaceDetectionError, GitOperationError, FileOperationError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';
export interface WorkspaceManagerDependencies {
    readonly gitService: GitService;
    readonly githubService: GitHubService;
    readonly prService: PRService;
    readonly versionService: VersionService;
    readonly changelogService: ChangelogService;
    readonly treeBuilder: WorkspaceTreeBuilder;
}
export interface WorkflowOptions {
    readonly workspaces: ReadonlyArray<WorkspaceConfig>;
    readonly createPR: boolean;
    readonly prOptions?: {
        readonly branchPrefix: string;
        readonly autoMerge: boolean;
        readonly draft: boolean;
        readonly title?: string;
    };
    readonly tagOptions?: {
        readonly shortTag: boolean;
        readonly tagPrefix?: string;
    };
    readonly repository: {
        readonly owner: string;
        readonly repo: string;
    };
    readonly branch?: string;
    readonly changelog?: {
        readonly preset?: string;
        readonly skip?: boolean;
    };
    readonly lastTag?: string | null;
}
export interface WorkflowResult {
    readonly tag: string;
    readonly allTags: ReadonlyArray<string>;
    readonly prNumber?: number;
    readonly prMerged?: boolean;
    readonly tree: WorkspaceTree;
}
export interface PRCreationResult {
    readonly number: number;
    readonly merged: boolean;
    readonly mergeCommitSha?: string;
}
export declare class WorkspaceManager extends Loggable {
    private readonly gitService;
    private readonly githubService;
    private readonly prService;
    private readonly versionService;
    private readonly changelogService;
    private readonly treeBuilder;
    constructor(deps: WorkspaceManagerDependencies);
    execute(options: WorkflowOptions): Promise<Result<WorkflowResult, Error>>;
    enrichWorkspaces(configs: ReadonlyArray<WorkspaceConfig>): Promise<Result<ReadonlyArray<Workspace>, WorkspaceDetectionError>>;
    detectChangedWorkspaces(workspaces: ReadonlyArray<Workspace>, lastTag: string | null, branch?: string): Promise<Result<ReadonlyArray<Workspace>, GitOperationError>>;
    calculateVersions(workspaces: ReadonlyArray<Workspace>, lastTag: string | null, branch: string): Promise<Result<ReadonlyArray<WorkspaceWithVersion>, Error>>;
    updateVersionFiles(workspaces: ReadonlyArray<WorkspaceWithVersion>): Promise<Result<void, FileOperationError>>;
    generateChangelogs(tree: WorkspaceTree, options: WorkflowOptions): Promise<Result<void, FileOperationError>>;
    private configureGit;
    createVersionCommit(tree: WorkspaceTree): Promise<Result<string, GitOperationError>>;
    createVersionBranch(tree: WorkspaceTree, options: WorkflowOptions): Promise<Result<string, GitOperationError>>;
    createVersionPR(tree: WorkspaceTree, options: WorkflowOptions, branchName: string): Promise<Result<PRCreationResult, Error>>;
    createVersionTags(tree: WorkspaceTree, options: WorkflowOptions, providedCommitSha?: string): Promise<Result<string[], GitOperationError>>;
}
//# sourceMappingURL=WorkspaceManager.d.ts.map