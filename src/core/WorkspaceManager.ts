/**
 * Workspace Manager
 *
 * Orchestrates version bumping workflow from detection to release
 */

import type { ChangelogPreset, ChangelogService } from '../services/ChangelogService.js';
import type { GitHubService } from '../services/GitHubService.js';
import type { GitService } from '../services/GitService.js';
import { LocalGitService } from '../services/LocalGitService.js';
import { PRService } from '../services/PRService.js';
import { TagService } from '../services/TagService.js';
import type { VersionService } from '../services/VersionService.js';
import { WorkspaceService } from '../services/WorkspaceService.js';
import { GitCommit, RepositoryInfo } from '../types/git.js';
import type { Result } from '../types/result.js';
import { err, ok } from '../types/result.js';
import type { Workspace, WorkspaceConfig, WorkspaceTree, WorkspaceWithVersion } from '../types/workspace.js';
import {
  FileOperationError,
  GitOperationError,
  WorkspaceDetectionError,
  WorkspaceValidationError,
} from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';
import { getAdapter } from './adapters/AdapterFactory.js';
import type { WorkspaceTreeBuilder } from './WorkspaceTreeBuilder.js';

/**
 * Service dependencies required by WorkspaceManager
 */
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

/** Options for workflow execution */
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

/** Result of workflow execution */
export interface WorkflowResult {
  readonly tag: string;
  readonly allTags: ReadonlyArray<string>;
  readonly prNumber?: number;
  readonly prMerged?: boolean;
  readonly tree: WorkspaceTree;
}

/** Result of PR creation */
export interface PRCreationResult {
  readonly number: number;
  readonly merged: boolean;
  readonly mergeCommitSha?: string;
}

/**
 * Main orchestrator for version bumping workflow
 */
export class WorkspaceManager extends Loggable {
  private readonly gitService: GitService;
  private readonly githubService: GitHubService;
  private readonly localGitService: LocalGitService;
  private readonly tagService: TagService;
  private readonly workspaceService: WorkspaceService;
  private readonly prService: PRService;
  private readonly versionService: VersionService;
  private readonly changelogService: ChangelogService;
  private readonly treeBuilder: WorkspaceTreeBuilder;

  constructor(deps: WorkspaceManagerDependencies) {
    super();
    this.gitService = deps.gitService;
    this.githubService = deps.githubService;
    this.localGitService = deps.localGitService;
    this.tagService = deps.tagService;
    this.workspaceService = deps.workspaceService;
    this.prService = deps.prService;
    this.versionService = deps.versionService;
    this.changelogService = deps.changelogService;
    this.treeBuilder = deps.treeBuilder;

    this.log.info('WorkspaceManager initialized');
  }

  // ====================
  // Public API
  // ====================

  /** Execute complete version bumping workflow */
  async execute(options: WorkflowOptions): Promise<Result<WorkflowResult, Error>> {
    this.log.info(
      {
        workspaceCount: options.workspaces.length,
        createPR: options.createPR,
        branch: options.branch ?? 'main',
      },
      'Starting workflow execution',
    );

    try {
      const mergedPRResult = await this.handleMergedPR(options);
      if (mergedPRResult) {
        return mergedPRResult;
      }

      return await this.executeVersionBump(options);
    } catch (error) {
      this.log.error(
        {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        'Workflow execution failed',
      );
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /** Enrich workspaces with detected metadata */
  async enrichWorkspaces(
    configs: ReadonlyArray<WorkspaceConfig>,
  ): Promise<Result<ReadonlyArray<Workspace>, WorkspaceDetectionError>> {
    return await this.workspaceService.enrichWorkspaces(configs);
  }

  /** Detect workspaces with changes since last tag */
  async detectChangedWorkspaces(
    workspaces: ReadonlyArray<Workspace>,
    lastTag: string | null,
    branch: string = 'main',
  ): Promise<Result<ReadonlyArray<Workspace>, GitOperationError>> {
    return await this.workspaceService.detectChangedWorkspaces(workspaces, lastTag, branch);
  }

  /** Calculate new versions for changed workspaces */
  async calculateVersions(
    workspaces: ReadonlyArray<Workspace>,
    lastTag: string | null,
    branch: string,
  ): Promise<Result<import('../services/VersionService.js').WorkspaceVersionResult, Error>> {
    return await this.versionService.calculateVersionsForWorkspaces(workspaces, lastTag, branch);
  }

  /** Update version files for all workspaces */
  async updateVersionFiles(workspaces: ReadonlyArray<WorkspaceWithVersion>): Promise<Result<void, FileOperationError>> {
    this.log.debug(
      {
        count: workspaces.length,
        workspaces: workspaces.map((w) => ({ name: w.name, version: w.newVersion })),
      },
      'Updating version files',
    );

    for (const workspace of workspaces) {
      const adapter = getAdapter(workspace.type);
      const updateResult = await adapter.update(workspace.path, workspace.newVersion);

      if (!updateResult.ok) {
        this.log.error({ path: workspace.path, version: workspace.newVersion }, 'Failed to update version file');
        return err(updateResult.error);
      }

      this.log.debug({ path: workspace.path, version: workspace.newVersion }, 'Version file updated');
    }

    return ok(undefined);
  }

  /** Generate changelogs for workspace tree */
  async generateChangelogs(tree: WorkspaceTree, options: WorkflowOptions): Promise<Result<void, FileOperationError>> {
    this.log.debug(
      {
        rootWorkspace: tree.root.workspace.name,
        childrenCount: tree.root.children.length,
        preset: options.changelog?.preset,
      },
      'Generating changelogs',
    );

    const commitsResult = await this.getCommitsForChangelog(options);
    if (!commitsResult.ok) {
      return err(commitsResult.error);
    }

    return await this.generateRootChangelog(tree, options, commitsResult.value);
  }

  /** Create version pull request */
  async createVersionPR(
    tree: WorkspaceTree,
    options: WorkflowOptions,
    branchName: string,
  ): Promise<Result<PRCreationResult, Error>> {
    this.log.debug({ version: tree.masterVersion, branch: branchName }, 'Creating version PR');

    const prResult = await this.createPR(tree, options, branchName);
    if (!prResult.ok) {
      return err(prResult.error);
    }

    const pr = prResult.value;
    this.log.info({ prNumber: pr.number, prUrl: pr.htmlUrl }, 'Version PR created');

    if (options.prOptions?.autoMerge) {
      return await this.handleAutoMerge(pr.number, branchName);
    }

    this.log.info({ prNumber: pr.number }, 'PR created without auto-merge - waiting for manual merge');
    return ok({
      number: pr.number,
      merged: false,
      mergeCommitSha: undefined,
    });
  }

  // ====================
  // Workflow Execution
  // ====================

  /** Check for merged PR and handle tags-only mode */
  private async handleMergedPR(options: WorkflowOptions): Promise<Result<WorkflowResult, Error> | null> {
    const mergeInfo = await this.detectMergedPR(options);
    if (!mergeInfo) {
      return null;
    }

    const { commitSha, prNumber } = mergeInfo;
    this.log.info('Detected merged version bump PR - creating tags only');

    const tagsResult = await this.createTagsForMergedPR(options, commitSha);
    if (!tagsResult.ok) {
      return err(tagsResult.error);
    }

    const { tree, allTags } = tagsResult.value;
    await this.cleanupPRBranch(prNumber, options.prOptions?.branchPrefix);

    return ok({
      tag: allTags.length > 0 ? `v${tree.masterVersion}` : '',
      allTags,
      prNumber,
      prMerged: true,
      tree,
    });
  }

  /** Execute normal version bump workflow */
  private async executeVersionBump(options: WorkflowOptions): Promise<Result<WorkflowResult, Error>> {
    const branch = options.branch || 'main';

    const lastTag = await this.getLastTag();
    if (!lastTag.ok) {
      return err(lastTag.error);
    }

    const enrichedWorkspaces = await this.enrichAndDetectChanges(options, lastTag.value, branch);
    if (!enrichedWorkspaces.ok) {
      return err(enrichedWorkspaces.error);
    }

    const treeResult = await this.buildWorkspaceTree(enrichedWorkspaces.value, lastTag.value, branch);
    if (!treeResult.ok) {
      return err(treeResult.error);
    }

    // If no version changes, return empty result (this is not an error)
    if (treeResult.value === null) {
      // Build a minimal tree with current versions for output
      const enrichResult = await this.enrichWorkspaces(options.workspaces);
      if (!enrichResult.ok) {
        return err(enrichResult.error);
      }
      const workspacesWithVersion = enrichResult.value.map((ws) => ({
        ...ws,
        newVersion: ws.version,
        hasChanges: false,
      }));
      const emptyTree = this.treeBuilder.build(workspacesWithVersion);

      return ok({
        tag: '',
        allTags: [],
        tree: emptyTree,
      });
    }

    const tree = treeResult.value;

    const updateResult = await this.updateFilesAndChangelogs(tree, { ...options, lastTag: lastTag.value });
    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    return await this.createReleaseArtifacts(tree, options);
  }

  // ====================
  // Merged PR Detection
  // ====================

  /** Detect if last commit is a merged PR */
  private async detectMergedPR(options: WorkflowOptions): Promise<{ commitSha: string; prNumber?: number } | null> {
    const targetBranch = options.branch || 'main';
    const lastCommitResult = await this.gitService.getLastCommit(targetBranch);

    if (!lastCommitResult.ok || !lastCommitResult.value) {
      return null;
    }

    const { message, sha } = lastCommitResult.value;
    this.log.info({ commitMessage: message, sha, branch: targetBranch }, 'Checking last commit');

    if (!this.isVersionBumpCommit(message, options)) {
      return null;
    }

    return {
      commitSha: sha,
      prNumber: this.extractPRNumber(message),
    };
  }

  /** Check if commit message is a version bump */
  private isVersionBumpCommit(message: string, options: WorkflowOptions): boolean {
    const prTitle = options.prOptions?.title || 'chore: version update';
    return message.startsWith('chore: bump version to') || message.startsWith(prTitle);
  }

  /** Extract PR number from commit message */
  private extractPRNumber(commitMessage: string): number | undefined {
    const prNumberMatch = commitMessage.match(/#(\d+)\)/);
    return prNumberMatch ? parseInt(prNumberMatch[1], 10) : undefined;
  }

  /** Create tags for merged PR using current versions */
  private async createTagsForMergedPR(
    options: WorkflowOptions,
    commitSha: string,
  ): Promise<Result<{ tree: WorkspaceTree; allTags: string[] }, Error>> {
    const enrichResult = await this.enrichWorkspaces(options.workspaces);
    if (!enrichResult.ok) {
      return err(enrichResult.error);
    }

    const workspacesWithVersion = enrichResult.value.map((ws) => ({
      ...ws,
      newVersion: ws.version,
      hasChanges: true,
    }));

    const tree = this.treeBuilder.build(workspacesWithVersion);
    const tagsResult = await this.createVersionTags(tree, options, commitSha);

    if (!tagsResult.ok) {
      return err(tagsResult.error);
    }

    const allTags = tagsResult.value;
    this.log.info({ tagCount: allTags.length }, 'Tags created for merged PR');

    return ok({ tree, allTags });
  }

  /** Clean up PR branch after merge */
  private async cleanupPRBranch(prNumber: number | undefined, branchPrefix: string | undefined): Promise<void> {
    if (!prNumber || !branchPrefix) {
      return;
    }

    const prDetailsResult = await this.prService.getPullRequest(prNumber);
    if (!prDetailsResult.ok) {
      this.log.warn({ prNumber, error: prDetailsResult.error.message }, 'Failed to get PR details for cleanup');
      return;
    }

    const branchName = prDetailsResult.value.headRef;
    try {
      await this.githubService.deleteBranch(branchName);
      this.log.info({ branch: branchName, prNumber }, 'Version branch deleted after manual merge');
    } catch (error) {
      this.log.warn({ prNumber, branchName, error }, 'Failed to delete branch after manual merge');
    }
  }

  // ====================
  // Version Bump Pipeline
  // ====================

  /** Get last tag from repository */
  private async getLastTag(): Promise<Result<string | null, Error>> {
    const lastTagResult = await this.gitService.getLastTag();
    if (!lastTagResult.ok) {
      return err(lastTagResult.error);
    }
    const lastTag = lastTagResult.value?.name || null;
    this.log.info({ lastTag }, 'Last tag retrieved');
    return ok(lastTag);
  }

  /** Enrich workspaces and detect changes */
  private async enrichAndDetectChanges(
    options: WorkflowOptions,
    lastTag: string | null,
    branch: string,
  ): Promise<Result<ReadonlyArray<Workspace>, Error>> {
    const enrichResult = await this.enrichWorkspaces(options.workspaces);
    if (!enrichResult.ok) {
      return err(enrichResult.error);
    }
    const enrichedWorkspaces = enrichResult.value;
    this.log.info({ count: enrichedWorkspaces.length }, 'Workspaces enriched');

    const changedResult = await this.detectChangedWorkspaces(enrichedWorkspaces, lastTag, branch);
    if (!changedResult.ok) {
      return err(changedResult.error);
    }
    const changedWorkspaces = changedResult.value;

    if (changedWorkspaces.length === 0) {
      return err(
        new WorkspaceValidationError(
          `No workspaces have changed since last tag (${lastTag || 'none'}). Branch: ${branch}, Total workspaces: ${enrichedWorkspaces.length}`,
        ),
      );
    }

    this.log.info({ count: changedWorkspaces.length }, 'Changed workspaces detected');
    return ok(changedWorkspaces);
  }

  /** Build workspace tree with versions */
  private async buildWorkspaceTree(
    changedWorkspaces: ReadonlyArray<Workspace>,
    lastTag: string | null,
    branch: string,
  ): Promise<Result<WorkspaceTree | null, Error>> {
    const versionsResult = await this.calculateVersions(changedWorkspaces, lastTag, branch);
    if (!versionsResult.ok) {
      return err(versionsResult.error);
    }

    const { workspaces: changedWorkspacesWithVersions, hasConventionalCommits } = versionsResult.value;

    // Check if any workspace actually has a new version
    const hasVersionChanges = changedWorkspacesWithVersions.some(
      (workspace) => workspace.newVersion !== workspace.version,
    );

    if (!hasVersionChanges) {
      // If no conventional commits at all → ERROR (developer forgot to use conventional commits)
      if (!hasConventionalCommits) {
        return err(
          new WorkspaceValidationError(
            'No conventional commits detected. Please use conventional commit format (feat:, fix:, etc.) to trigger version bumps.',
          ),
        );
      }

      // If has conventional commits but no version changes → OK (non-bumping commits like chore:, docs:)
      this.log.info(
        'No version changes detected. Changes include only non-bumping conventional commits (chore, docs, style, etc.).',
      );
      return ok(null);
    }

    const allWorkspacesWithVersions = this.mergeWorkspaceVersions(changedWorkspaces, changedWorkspacesWithVersions);
    const tree = this.treeBuilder.build(allWorkspacesWithVersions);
    this.log.info({ rootVersion: tree.masterVersion }, 'Workspace tree built');

    return ok(tree);
  }

  /** Merge changed workspaces with their versions */
  private mergeWorkspaceVersions(
    allWorkspaces: ReadonlyArray<Workspace>,
    changedWorkspaces: ReadonlyArray<WorkspaceWithVersion>,
  ): WorkspaceWithVersion[] {
    return allWorkspaces.map((workspace) => {
      const changed = changedWorkspaces.find((w) => w.path === workspace.path);
      if (changed) {
        return changed;
      }
      return {
        ...workspace,
        newVersion: workspace.version,
      };
    });
  }

  /** Update version files and generate changelogs */
  private async updateFilesAndChangelogs(tree: WorkspaceTree, options: WorkflowOptions): Promise<Result<void, Error>> {
    // Get all workspaces that have changes (need version updates)
    const workspacesToUpdate = tree.allWorkspaces.filter((ws) => ws.hasChanges);
    const updateResult = await this.updateVersionFiles(workspacesToUpdate);
    if (!updateResult.ok) {
      return err(updateResult.error);
    }
    this.log.info('Version files updated');

    if (!options.changelog?.skip) {
      const changelogResult = await this.generateChangelogs(tree, options);
      if (!changelogResult.ok) {
        return err(changelogResult.error);
      }
      this.log.info('Changelogs generated');
    }

    return ok(undefined);
  }

  // ====================
  // Changelog Generation
  // ====================

  /** Get commits for changelog generation */
  private async getCommitsForChangelog(
    options: WorkflowOptions,
  ): Promise<Result<ReadonlyArray<GitCommit>, FileOperationError>> {
    const branch = options.branch || 'main';
    const base = options.lastTag || 'HEAD^';
    this.log.debug({ branch, base, hasLastTag: !!options.lastTag }, 'Getting commits for changelog');

    const commitsResult = await this.gitService.getCommitsSince(base, branch);

    if (!commitsResult.ok) {
      this.log.error({ error: commitsResult.error, branch, base }, 'Failed to get commits for changelog');
      return err(
        new FileOperationError(
          'CHANGELOG.md',
          'generate',
          'Failed to get commits for changelog generation',
          commitsResult.error,
        ),
      );
    }

    this.log.debug({ rawCommitCount: commitsResult.value.length }, 'Raw commits retrieved');
    return ok(commitsResult.value);
  }

  /** Generate changelog for root workspace */
  private async generateRootChangelog(
    tree: WorkspaceTree,
    options: WorkflowOptions,
    commits: ReadonlyArray<GitCommit>,
  ): Promise<Result<void, FileOperationError>> {
    this.log.debug(
      {
        commitCount: commits.length,
        firstCommit: commits[0]?.message,
        commits: commits.map((c) => ({ sha: c.sha, message: c.message.substring(0, 50) })),
      },
      'Retrieved commits for changelog generation',
    );

    const rootChangelogPath = `${tree.root.workspace.path}/CHANGELOG.md`;

    const generateOptions = {
      workspace: tree.root.workspace,
      changelogPath: rootChangelogPath,
      preset: (options.changelog?.preset as ChangelogPreset) || 'conventionalcommits',
      childWorkspaces: tree.root.children,
      repository: options.repository,
      lastTag: options.lastTag,
      commits,
    };

    this.log.debug({ path: rootChangelogPath }, 'Generating root changelog');

    const rootResult = await this.changelogService.generateForWorkspace(generateOptions);

    if (!rootResult) {
      return err(new FileOperationError(rootChangelogPath, 'generate', 'Failed to generate root changelog'));
    }

    return ok(undefined);
  }

  // ====================
  // Release Artifacts
  // ====================

  /** Create PR or direct commit with tags */
  private async createReleaseArtifacts(
    tree: WorkspaceTree,
    options: WorkflowOptions,
  ): Promise<Result<WorkflowResult, Error>> {
    if (options.createPR) {
      return await this.createPRWorkflow(tree, options);
    }
    return await this.createDirectCommitWorkflow(tree, options);
  }

  /** Create PR workflow with optional auto-merge */
  private async createPRWorkflow(
    tree: WorkspaceTree,
    options: WorkflowOptions,
  ): Promise<Result<WorkflowResult, Error>> {
    const branchPrefix = options.prOptions?.branchPrefix || 'version-bump';
    const branchResult = await this.localGitService.createVersionBranch(tree, branchPrefix);
    if (!branchResult.ok) {
      return err(branchResult.error);
    }
    this.log.info({ branch: branchResult.value }, 'Version branch created');

    const prResult = await this.createVersionPR(tree, options, branchResult.value);
    if (!prResult.ok) {
      return err(prResult.error);
    }

    const { number: prNumber, merged: prMerged, mergeCommitSha } = prResult.value;
    this.log.info({ prNumber, merged: prMerged }, 'Pull request created');

    let allTags: string[] = [];
    if (prMerged && mergeCommitSha) {
      const tagsResult = await this.createVersionTags(tree, options, mergeCommitSha);
      if (!tagsResult.ok) {
        return err(tagsResult.error);
      }
      allTags = tagsResult.value;
      this.log.info({ tagCount: allTags.length }, 'Version tags created after PR merge');
    } else {
      this.log.info({ prNumber }, 'PR created without auto-merge - tags will be created after manual merge');
    }

    return ok({
      tag: allTags.length > 0 ? `v${tree.masterVersion}` : '',
      allTags,
      prNumber,
      prMerged: allTags.length > 0,
      tree,
    });
  }

  /** Create direct commit workflow with tags */
  private async createDirectCommitWorkflow(
    tree: WorkspaceTree,
    options: WorkflowOptions,
  ): Promise<Result<WorkflowResult, Error>> {
    const commitResult = await this.localGitService.createVersionCommit(tree);
    if (!commitResult.ok) {
      return err(commitResult.error);
    }
    const commitSha = commitResult.value;
    this.log.info({ sha: commitSha }, 'Version commit created');

    const tagsResult = await this.createVersionTags(tree, options, commitSha);
    if (!tagsResult.ok) {
      return err(tagsResult.error);
    }
    const allTags = tagsResult.value;
    this.log.info({ tagCount: allTags.length }, 'Version tags created');

    return ok({
      tag: `v${tree.masterVersion}`,
      allTags,
      tree,
    });
  }

  // ====================
  // PR Management
  // ====================

  /** Create PR with title and body */
  private async createPR(
    tree: WorkspaceTree,
    options: WorkflowOptions,
    branchName: string,
  ): Promise<Result<{ number: number; htmlUrl: string }, Error>> {
    const title = `chore: bump version to ${tree.masterVersion}`;
    const body = PRService.buildPRBody(tree);

    return await this.prService.create({
      title,
      body,
      head: branchName,
      base: options.branch || 'main',
      draft: options.prOptions?.draft || false,
    });
  }

  /** Handle auto-merge: wait for checks, merge, cleanup */
  private async handleAutoMerge(prNumber: number, branchName: string): Promise<Result<PRCreationResult, Error>> {
    const checksResult = await this.waitForPRChecks(prNumber);
    if (!checksResult.ok) {
      return err(checksResult.error);
    }

    const mergeResult = await this.mergePR(prNumber);
    if (!mergeResult.ok) {
      return ok({
        number: prNumber,
        merged: false,
        mergeCommitSha: undefined,
      });
    }

    const mergeCommitSha = mergeResult.value;
    await this.cleanupBranch(branchName);

    return ok({
      number: prNumber,
      merged: true,
      mergeCommitSha,
    });
  }

  /** Wait for PR checks to complete */
  private async waitForPRChecks(prNumber: number): Promise<Result<void, Error>> {
    this.log.debug({ prNumber }, 'Waiting for PR checks to complete');

    const checksResult = await this.prService.waitForChecks({
      prNumber,
      timeout: 300000,
      interval: 10000,
    });

    if (!checksResult.ok) {
      this.log.error({ prNumber, error: checksResult.error.message }, 'Failed to wait for PR checks');
      return err(checksResult.error);
    }

    const checksStatus = checksResult.value;

    if (!checksStatus.allPassed) {
      const checkError = new Error(
        `PR checks did not pass. Failed checks: ${checksStatus.failedCheckNames?.join(', ') || 'unknown'}`,
      );
      this.log.error(
        {
          prNumber,
          failedChecks: checksStatus.failedChecks,
          failedCheckNames: checksStatus.failedCheckNames,
          mergeableState: checksStatus.mergeableState,
        },
        'PR checks failed',
      );
      return err(checkError);
    }

    this.log.info({ prNumber }, 'All PR checks passed');
    return ok(undefined);
  }

  /** Merge PR and return commit SHA */
  private async mergePR(prNumber: number): Promise<Result<string, Error>> {
    this.log.debug({ prNumber }, 'Merging PR');

    const mergeResult = await this.prService.merge({
      prNumber,
      mergeMethod: 'squash',
    });

    if (!mergeResult.ok) {
      this.log.warn({ prNumber }, 'Auto-merge failed - PR remains open');
      return err(mergeResult.error);
    }

    const mergeCommitSha = mergeResult.value.sha;
    this.log.info({ prNumber, mergeCommitSha }, 'PR auto-merged');
    return ok(mergeCommitSha);
  }

  /** Cleanup branch after merge */
  private async cleanupBranch(branchName: string): Promise<void> {
    try {
      await this.githubService.deleteBranch(branchName);
      this.log.info({ branch: branchName }, 'Version branch deleted after merge');
    } catch (error) {
      this.log.warn({ branch: branchName, error }, 'Failed to delete branch after merge');
    }
  }

  // ====================
  // Tag Management
  // ====================

  /** Create version tags */
  private async createVersionTags(
    tree: WorkspaceTree,
    options: WorkflowOptions,
    providedCommitSha?: string,
  ): Promise<Result<string[], GitOperationError>> {
    if (providedCommitSha) {
      return await this.tagService.createVersionTags(tree.masterVersion, providedCommitSha, options.tagOptions);
    }

    const branch = options.branch || 'main';
    return await this.tagService.createVersionTagsForBranch(tree.masterVersion, branch, options.tagOptions);
  }
}
