import type { ChangelogService } from '../services/ChangelogService.js';
import type { GitHubService } from '../services/GitHubService.js';
import type { GitService } from '../services/GitService.js';
import { LocalGitService } from '../services/LocalGitService.js';
import { PRService } from '../services/PRService.js';
import { TagService } from '../services/TagService.js';
import type { VersionService } from '../services/VersionService.js';
import { WorkspaceService } from '../services/WorkspaceService.js';
import { RepositoryInfo } from '../types/git.js';
import type { Result } from '../types/result.js';
import type { Workspace, WorkspaceConfig, WorkspaceTree, WorkspaceWithVersion } from '../types/workspace.js';
import { FileOperationError, GitOperationError, WorkspaceDetectionError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';
import type { WorkspaceTreeBuilder } from './WorkspaceTreeBuilder.js';
export interface WorkspaceManagerDependencies {
    readonly gitService: GitService;
    readonly githubService: GitHubService;
    readonly localGitService: LocalGitService;
    readonly tagService: TagService;
    readonly workspaceService: WorkspaceService;
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
    readonly repository: RepositoryInfo;
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
    private readonly localGitService;
    private readonly tagService;
    private readonly workspaceService;
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
    createVersionPR(tree: WorkspaceTree, options: WorkflowOptions, branchName: string): Promise<Result<PRCreationResult, Error>>;
    private handleMergedPR;
    private executeVersionBump;
    private detectMergedPR;
    private isVersionBumpCommit;
    private extractPRNumber;
    private createTagsForMergedPR;
    private cleanupPRBranch;
    private getLastTag;
    private enrichAndDetectChanges;
    private buildWorkspaceTree;
    private mergeWorkspaceVersions;
    private updateFilesAndChangelogs;
    private getCommitsForChangelog;
    private generateRootChangelog;
    private createReleaseArtifacts;
    private createPRWorkflow;
    private createDirectCommitWorkflow;
    private createPR;
    private handleAutoMerge;
    private waitForPRChecks;
    private mergePR;
    private cleanupBranch;
    private createVersionTags;
}
//# sourceMappingURL=WorkspaceManager.d.ts.map