import type { GitService } from '../services/GitService.js';
import { PRService } from '../services/PRService.js';
import type { VersionService } from './VersionService.js';
import type { ChangelogService } from './ChangelogService.js';
import type { WorkspaceTreeBuilder } from './WorkspaceTreeBuilder.js';
import type { WorkspaceConfig, Workspace, WorkspaceWithVersion, WorkspaceTree } from '../types/workspace.js';
import type { Result } from '../types/result.js';
import { WorkspaceDetectionError, GitOperationError, FileOperationError } from '../utils/errors.js';
export interface WorkspaceManagerDependencies {
    readonly gitService: GitService;
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
    readonly changelogPreset?: string;
}
export interface WorkflowResult {
    readonly tag: string;
    readonly allTags: ReadonlyArray<string>;
    readonly prNumber?: number;
    readonly tree: WorkspaceTree;
}
export declare class WorkspaceManager {
    private readonly gitService;
    private readonly prService;
    private readonly versionService;
    private readonly changelogService;
    private readonly treeBuilder;
    constructor(deps: WorkspaceManagerDependencies);
    execute(options: WorkflowOptions): Promise<Result<WorkflowResult, Error>>;
    enrichWorkspaces(configs: ReadonlyArray<WorkspaceConfig>): Promise<Result<ReadonlyArray<Workspace>, WorkspaceDetectionError>>;
    detectChangedWorkspaces(workspaces: ReadonlyArray<Workspace>, lastTag: string | null, branch?: string): Promise<Result<ReadonlyArray<Workspace>, GitOperationError>>;
    calculateVersions(workspaces: ReadonlyArray<Workspace>, lastTag: string | null): Promise<Result<ReadonlyArray<WorkspaceWithVersion>, Error>>;
    updateVersionFiles(workspaces: ReadonlyArray<WorkspaceWithVersion>): Promise<Result<void, FileOperationError>>;
    generateChangelogs(tree: WorkspaceTree, options: WorkflowOptions): Promise<Result<void, FileOperationError>>;
    private generateChangelogsRecursive;
    createVersionCommit(tree: WorkspaceTree): Promise<Result<string, GitOperationError>>;
    createVersionBranch(tree: WorkspaceTree, options: WorkflowOptions): Promise<Result<string, GitOperationError>>;
    createVersionPR(tree: WorkspaceTree, options: WorkflowOptions, branchName: string): Promise<Result<number, Error>>;
    createVersionTags(tree: WorkspaceTree, options: WorkflowOptions, providedCommitSha?: string): Promise<Result<string[], GitOperationError>>;
}
//# sourceMappingURL=WorkspaceManager.d.ts.map