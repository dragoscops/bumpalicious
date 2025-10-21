/**
 * Workspace Manager
 *
 * Orchestrates the complete version bumping workflow:
 * 1. Enrich workspaces with detected metadata
 * 2. Detect changed workspaces since last tag
 * 3. Build and validate workspace tree
 * 4. Calculate new versions
 * 5. Update version files
 * 6. Generate changelogs
 * 7. Create PR or commit
 * 8. Create version tags
 *
 * Usage:
 * ```typescript
 * const manager = new WorkspaceManager({
 *   gitService,
 *   prService,
 *   versionService,
 *   changelogService,
 *   treeBuilder,
 *   adapterFactory
 * });
 *
 * await manager.execute({
 *   workspaces: configs,
 *   createPR: true,
 *   ...
 * });
 * ```
 */

import type { GitService } from '../services/GitService.js';
import { PRService } from '../services/PRService.js';
import type { VersionService } from './VersionService.js';
import type { ChangelogService } from './ChangelogService.js';
import type { WorkspaceTreeBuilder } from './WorkspaceTreeBuilder.js';
import { getAdapter } from './adapters/AdapterFactory.js';
import { Loggable } from '../Loggable.js';
import * as exec from '@actions/exec';
import type {
  WorkspaceConfig,
  Workspace,
  WorkspaceWithVersion,
  WorkspaceTree,
  WorkspaceNode,
} from '../types/workspace.js';
import type { Version } from '../types/version.js';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import {
  WorkspaceDetectionError,
  WorkspaceValidationError,
  GitOperationError,
  FileOperationError,
} from '../utils/errors.js';
import { parseCommitMessages } from '../parsers/ConventionalCommitParser.js';

/**
 * Workspace Manager dependencies
 */
export interface WorkspaceManagerDependencies {
  readonly gitService: GitService;
  readonly prService: PRService;
  readonly versionService: VersionService;
  readonly changelogService: ChangelogService;
  readonly treeBuilder: WorkspaceTreeBuilder;
}

/**
 * Workflow execution options
 */
export interface WorkflowOptions {
  /** Workspace configurations to process */
  readonly workspaces: ReadonlyArray<WorkspaceConfig>;
  /** Whether to create a PR instead of direct commit */
  readonly createPR: boolean;
  /** PR options (if createPR is true) */
  readonly prOptions?: {
    readonly branchPrefix: string;
    readonly autoMerge: boolean;
    readonly draft: boolean;
  };
  /** Tag options */
  readonly tagOptions?: {
    readonly shortTag: boolean;
    readonly tagPrefix?: string;
  };
  /** Repository context */
  readonly repository: {
    readonly owner: string;
    readonly repo: string;
  };
  /** Branch to use for operations (defaults to 'main') */
  readonly branch?: string;
  /** Changelog preset */
  readonly changelogPreset?: string;
}

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  /** Master version tag created */
  readonly tag: string;
  /** All tags created (including short tags and workspace tags) */
  readonly allTags: ReadonlyArray<string>;
  /** PR number (if PR was created) */
  readonly prNumber?: number;
  /** Workspace tree structure */
  readonly tree: WorkspaceTree;
}

/**
 * Workspace Manager
 *
 * Main orchestrator for version bumping workflow
 */
export class WorkspaceManager extends Loggable {
  private readonly gitService: GitService;
  private readonly prService: PRService;
  private readonly versionService: VersionService;
  private readonly changelogService: ChangelogService;
  private readonly treeBuilder: WorkspaceTreeBuilder;

  /**
   * Create a new Workspace Manager
   *
   * @param deps - Service dependencies
   */
  constructor(deps: WorkspaceManagerDependencies) {
    super();
    this.gitService = deps.gitService;
    this.prService = deps.prService;
    this.versionService = deps.versionService;
    this.changelogService = deps.changelogService;
    this.treeBuilder = deps.treeBuilder;

    this.log.info('WorkspaceManager initialized');
  }

  /**
   * Execute complete version bumping workflow
   *
   * @param options - Workflow options
   * @returns Result with workflow outcome
   */
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
      // Step 1: Get last tag
      const lastTagResult = await this.gitService.getLastTag();
      if (!lastTagResult.ok) {
        return err(lastTagResult.error);
      }
      const lastTag = lastTagResult.value?.name || null;
      this.log.info({ lastTag }, 'Last tag retrieved');

      // Step 2: Enrich workspaces
      const enrichResult = await this.enrichWorkspaces(options.workspaces);
      if (!enrichResult.ok) {
        return err(enrichResult.error);
      }
      const enrichedWorkspaces = enrichResult.value;
      this.log.info({ count: enrichedWorkspaces.length }, 'Workspaces enriched');

      // Step 3: Detect changed workspaces
      const branch = options.branch || 'main';
      const changedResult = await this.detectChangedWorkspaces(enrichedWorkspaces, lastTag, branch);
      if (!changedResult.ok) {
        return err(changedResult.error);
      }
      const changedWorkspaces = changedResult.value;

      if (changedWorkspaces.length === 0) {
        this.log.info('No workspaces have changed - skipping version bump');
        // Return empty result - no work needed
        return err(new WorkspaceValidationError('No workspaces have changed since last tag'));
      }

      this.log.info({ count: changedWorkspaces.length }, 'Changed workspaces detected');

      // Step 4: Calculate new versions for changed workspaces
      const versionsResult = await this.calculateVersions(changedWorkspaces, lastTag);
      if (!versionsResult.ok) {
        return err(versionsResult.error);
      }
      const changedWorkspacesWithVersions = versionsResult.value;
      this.log.info('New versions calculated');

      // Step 5: Merge changed workspaces with unchanged workspaces
      // Unchanged workspaces keep their current version as newVersion
      const allWorkspacesWithVersions: WorkspaceWithVersion[] = enrichedWorkspaces.map((workspace) => {
        const changed = changedWorkspacesWithVersions.find((w) => w.path === workspace.path);
        if (changed) {
          return changed;
        }
        // Workspace hasn't changed, keep current version
        return {
          ...workspace,
          newVersion: workspace.version,
        };
      });

      // Step 6: Build workspace tree from all workspaces
      const tree = this.treeBuilder.build(allWorkspacesWithVersions);
      this.log.info({ rootVersion: tree.masterVersion }, 'Workspace tree built');

      // Step 7: Update version files (only for changed workspaces)
      const updateResult = await this.updateVersionFiles(changedWorkspacesWithVersions);
      if (!updateResult.ok) {
        return err(updateResult.error);
      }
      this.log.info('Version files updated');

      // Step 8: Generate changelogs
      const changelogResult = await this.generateChangelogs(tree, options);
      if (!changelogResult.ok) {
        return err(changelogResult.error);
      }
      this.log.info('Changelogs generated');

      // Step 8: Create PR or commit
      let prNumber: number | undefined;
      let commitSha: string | undefined;
      if (options.createPR) {
        // Create and push branch for PR
        const branchResult = await this.createVersionBranch(tree, options);
        if (!branchResult.ok) {
          return err(branchResult.error);
        }
        this.log.info({ branch: branchResult.value }, 'Version branch created');

        // Get the commit SHA from the just-pushed branch
        const branchRef = `heads/${branchResult.value}`;
        this.log.debug({ branchRef }, 'Looking up branch ref to get commit SHA');
        const refResult = await this.gitService.getRef(branchRef);
        if (!refResult.ok) {
          this.log.error({ error: refResult.error }, 'Failed to get branch ref');
          return err(refResult.error);
        }
        commitSha = refResult.value.sha;
        this.log.debug({ commitSha }, 'Got commit SHA from branch ref');

        const prResult = await this.createVersionPR(tree, options, branchResult.value);
        if (!prResult.ok) {
          return err(prResult.error);
        }
        prNumber = prResult.value;
        this.log.info({ prNumber }, 'Pull request created');
      } else {
        const commitResult = await this.createVersionCommit(tree);
        if (!commitResult.ok) {
          return err(commitResult.error);
        }
        commitSha = commitResult.value;
        this.log.info({ sha: commitResult.value }, 'Version commit created');
      }

      this.log.debug({ commitSha, hasSha: !!commitSha }, 'About to create tags with commit SHA');

      // Step 9: Create tags using the commit SHA
      const tagsResult = await this.createVersionTags(tree, options, commitSha);
      if (!tagsResult.ok) {
        return err(tagsResult.error);
      }
      const allTags = tagsResult.value;
      this.log.info({ tagCount: allTags.length }, 'Version tags created');

      const result: WorkflowResult = {
        tag: `v${tree.masterVersion}`,
        allTags,
        prNumber,
        tree,
      };

      this.log.info({ tag: result.tag }, 'Workflow completed successfully');
      return ok(result);
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

  /**
   * Enrich workspaces with detected name and version
   *
   * @param configs - Workspace configurations
   * @returns Result with enriched workspaces
   */
  async enrichWorkspaces(
    configs: ReadonlyArray<WorkspaceConfig>,
  ): Promise<Result<ReadonlyArray<Workspace>, WorkspaceDetectionError>> {
    this.log.debug(
      {
        count: configs.length,
        workspaces: configs.map((c) => ({ path: c.path, type: c.type })),
      },
      'Enriching workspaces',
    );

    const enriched: Workspace[] = [];

    for (const config of configs) {
      const adapter = getAdapter(config.type);
      const detectResult = await adapter.detect(config.path);

      if (!detectResult.ok) {
        this.log.error({ path: config.path, type: config.type }, 'Failed to detect workspace info');
        return err(detectResult.error);
      }

      const info = detectResult.value;
      const workspace: Workspace = {
        ...config,
        name: info.name,
        version: info.version,
        hasChanges: false, // Will be set in detectChangedWorkspaces
        changedFiles: [],
      };

      enriched.push(workspace);
      this.log.debug({ path: config.path, name: info.name, version: info.version }, 'Workspace enriched');
    }

    return ok(enriched);
  }

  /**
   * Detect workspaces with changes since last tag
   *
   * @param workspaces - Enriched workspaces
   * @param lastTag - Last git tag
   * @param branch - Branch to compare against (defaults to 'main')
   * @returns Result with changed workspaces
   */
  async detectChangedWorkspaces(
    workspaces: ReadonlyArray<Workspace>,
    lastTag: string | null,
    branch: string = 'main',
  ): Promise<Result<ReadonlyArray<Workspace>, GitOperationError>> {
    this.log.debug(
      {
        lastTag,
        branch,
        workspaceCount: workspaces.length,
        workspaces: workspaces.map((w) => ({ name: w.name, path: w.path, type: w.type })),
      },
      'Detecting changed workspaces',
    );

    // If no last tag, all workspaces are considered changed
    if (!lastTag) {
      this.log.info('No previous tag - all workspaces marked as changed');
      return ok(
        workspaces.map((w) => ({
          ...w,
          hasChanges: true,
          changedFiles: ['*'], // Indicate all files changed
        })),
      );
    }

    // Get changed files since last tag
    const changedFilesResult = await this.gitService.getChangedFiles(lastTag, branch);
    if (!changedFilesResult.ok) {
      return err(changedFilesResult.error);
    }

    const allChangedFiles = changedFilesResult.value.files;
    this.log.debug(
      {
        fileCount: allChangedFiles.length,
        files: allChangedFiles.map((f) => f.path),
        commitCount: changedFilesResult.value.commits?.length,
      },
      'Changed files retrieved from comparison',
    );

    // Map workspaces to changed files
    const updated: Workspace[] = workspaces.map((workspace) => {
      const workspacePath = workspace.path === '.' ? '' : workspace.path;
      const changedInWorkspace = allChangedFiles.filter((file) => {
        if (workspacePath === '') {
          // Root workspace - all files belong to it
          return true;
        }
        // Child workspace - only files within its path
        return file.path.startsWith(workspacePath + '/') || file.path === workspacePath;
      });

      this.log.debug(
        {
          workspace: workspace.name,
          workspacePath,
          totalFiles: allChangedFiles.length,
          matchedFiles: changedInWorkspace.length,
          matchedFilenames: changedInWorkspace.map((f) => f.path),
        },
        'Workspace file matching',
      );

      return {
        ...workspace,
        hasChanges: changedInWorkspace.length > 0,
        changedFiles: changedInWorkspace.map((f) => f.path),
      };
    });

    const changedWorkspaces = updated.filter((w) => w.hasChanges);
    this.log.info(
      {
        changedCount: changedWorkspaces.length,
        changedWorkspaceNames: changedWorkspaces.map((w) => w.name),
        totalWorkspaces: workspaces.length,
      },
      'Changed workspaces identified',
    );

    return ok(changedWorkspaces);
  }

  /**
   * Calculate new versions for changed workspaces
   *
   * @param workspaces - Changed workspaces
   * @param lastTag - Last git tag
   * @returns Result with workspaces with new versions
   */
  async calculateVersions(
    workspaces: ReadonlyArray<Workspace>,
    lastTag: string | null,
  ): Promise<Result<ReadonlyArray<WorkspaceWithVersion>, Error>> {
    this.log.debug(
      {
        workspaceCount: workspaces.length,
        lastTag,
      },
      'Calculating new versions',
    );

    // Get commits since last tag (use HEAD^ if no tag to get at least one commit)
    const base = lastTag || 'HEAD^';
    const commitsResult = await this.gitService.getCommitsSince(base);
    if (!commitsResult.ok) {
      return err(commitsResult.error);
    }

    const commits = commitsResult.value;
    const commitMessages = commits.map((c) => c.message);

    this.log.debug(
      {
        base,
        commitCount: commits.length,
        firstMessage: commitMessages[0]?.split('\n')[0],
      },
      'Commits retrieved for version calculation',
    );

    const workspacesWithVersions: WorkspaceWithVersion[] = [];

    for (const workspace of workspaces) {
      // Filter commits for this workspace
      const workspaceCommits =
        workspace.path === '.'
          ? commitMessages // Root gets all commits
          : commitMessages.filter(() => {
              // Check if commit affects this workspace (simple heuristic)
              // In practice, we'd check commit file changes
              return true; // For now, include all commits
            });

      // Parse commits to get bump type
      const analysis = parseCommitMessages(workspaceCommits);

      let newVersion: Version;
      if (analysis) {
        // Calculate version based on commit analysis
        newVersion = this.versionService.calculateNewVersion(workspace.version, analysis);
        this.log.debug(
          { workspace: workspace.path, oldVersion: workspace.version, newVersion, bumpType: analysis.type },
          'Version calculated from commits',
        );
      } else {
        // No conventional commits - default to patch bump
        newVersion = this.versionService.increaseVersion(workspace.version, 'patch');
        this.log.debug(
          { workspace: workspace.path, oldVersion: workspace.version, newVersion },
          'Version bumped (patch - no conventional commits)',
        );
      }

      workspacesWithVersions.push({
        ...workspace,
        newVersion,
      });
    }

    return ok(workspacesWithVersions);
  }

  /**
   * Update version files for all workspaces
   *
   * @param workspaces - Workspaces with new versions
   * @returns Result indicating success or failure
   */
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

  /**
   * Generate changelogs for all workspaces
   *
   * @param tree - Workspace tree
   * @param options - Workflow options
   * @returns Result indicating success or failure
   */
  async generateChangelogs(tree: WorkspaceTree, options: WorkflowOptions): Promise<Result<void, FileOperationError>> {
    this.log.debug(
      {
        rootWorkspace: tree.root.workspace.name,
        childrenCount: tree.root.children.length,
        preset: options.changelogPreset,
      },
      'Generating changelogs',
    );

    // Generate changelog for root workspace
    const rootPath = tree.root.workspace.path === '.' ? '.' : tree.root.workspace.path;
    const rootChangelogPath = rootPath === '.' ? 'CHANGELOG.md' : `${rootPath}/CHANGELOG.md`;

    const rootResult = await this.changelogService.generateForWorkspace({
      workspace: tree.root.workspace,
      changelogPath: rootChangelogPath,
      preset: (options.changelogPreset as any) || 'conventionalcommits',
      childWorkspaces: tree.root.children,
      repository: options.repository,
    });

    if (!rootResult) {
      return err(new FileOperationError(rootChangelogPath, 'generate', 'Failed to generate root changelog'));
    }

    this.log.debug({ path: rootChangelogPath }, 'Root changelog generated');

    // Generate changelogs for child workspaces (recursively)
    await this.generateChangelogsRecursive(tree.root.children, options);

    return ok(undefined);
  }

  /**
   * Generate changelogs recursively for workspace nodes
   *
   * @param nodes - Workspace nodes
   * @param options - Workflow options
   * @private
   */
  private async generateChangelogsRecursive(
    nodes: ReadonlyArray<WorkspaceNode>,
    options: WorkflowOptions,
  ): Promise<void> {
    for (const node of nodes) {
      const path = node.workspace.path;
      const changelogPath = `${path}/CHANGELOG.md`;

      await this.changelogService.generateForWorkspace({
        workspace: node.workspace,
        changelogPath,
        preset: (options.changelogPreset as any) || 'conventionalcommits',
        repository: options.repository,
      });

      this.log.debug({ path: changelogPath }, 'Workspace changelog generated');

      // Recurse to children
      if (node.children.length > 0) {
        await this.generateChangelogsRecursive(node.children, options);
      }
    }
  }

  /**
   * Configure git user for commits
   *
   * Sets git user.name and user.email if not already configured.
   * Uses github-actions[bot] as default.
   */
  private async configureGit(): Promise<void> {
    try {
      // Check if user.name is already configured
      let hasUserName = false;
      await exec.exec('git', ['config', 'user.name'], {
        ignoreReturnCode: true,
        listeners: {
          stdout: (data: Buffer) => {
            hasUserName = data.toString().trim().length > 0;
          },
        },
      });

      if (!hasUserName) {
        await exec.exec('git', ['config', 'user.name', 'github-actions[bot]']);
        this.log.debug('Configured git user.name');
      }

      // Check if user.email is already configured
      let hasUserEmail = false;
      await exec.exec('git', ['config', 'user.email'], {
        ignoreReturnCode: true,
        listeners: {
          stdout: (data: Buffer) => {
            hasUserEmail = data.toString().trim().length > 0;
          },
        },
      });

      if (!hasUserEmail) {
        await exec.exec('git', ['config', 'user.email', 'github-actions[bot]@users.noreply.github.com']);
        this.log.debug('Configured git user.email');
      }
    } catch (error) {
      // Log but don't fail - let the commit fail if git config is truly broken
      this.log.warn({ error }, 'Failed to configure git user, will proceed anyway');
    }
  }

  /**
   * Create version commit
   *
   * Creates a Git commit with version changes using local Git commands.
   * This method stages all changes and commits them with a version bump message.
   *
   * @param tree - Workspace tree
   * @returns Result with commit SHA
   */
  async createVersionCommit(tree: WorkspaceTree): Promise<Result<string, GitOperationError>> {
    this.log.debug({ version: tree.masterVersion }, 'Creating version commit');

    try {
      // Ensure git user is configured
      await this.configureGit();

      // Stage all changes (version files and changelogs)
      await exec.exec('git', ['add', '-A']);

      // Create commit
      const commitMessage = `chore: bump version to ${tree.masterVersion}`;
      await exec.exec('git', ['commit', '-m', commitMessage, '--no-verify']);

      // Get the commit SHA
      let commitSha = '';
      await exec.exec('git', ['rev-parse', 'HEAD'], {
        listeners: {
          stdout: (data: Buffer) => {
            commitSha += data.toString().trim();
          },
        },
      });

      // Get current branch name
      let branchName = '';
      await exec.exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        listeners: {
          stdout: (data: Buffer) => {
            branchName += data.toString().trim();
          },
        },
      });

      // Push the commit with upstream tracking
      await exec.exec('git', ['push', '--set-upstream', 'origin', branchName, '--no-verify']);

      this.log.info({ sha: commitSha, message: commitMessage }, 'Version commit created and pushed');
      return ok(commitSha);
    } catch (error) {
      const gitError = new GitOperationError('createVersionCommit', 'Failed to create version commit', error);
      this.log.error({ error: gitError }, 'Failed to create version commit');
      return err(gitError);
    }
  }

  /**
   * Create and push version branch for PR
   *
   * @param tree - Workspace tree
   * @param options - Workflow options
   * @returns Result with branch name
   */
  async createVersionBranch(tree: WorkspaceTree, options: WorkflowOptions): Promise<Result<string, GitOperationError>> {
    // Add random suffix to avoid branch name collisions on retry
    const randomSuffix = Math.floor(Math.random() * 10000).toString(36);
    const branchName = `${options.prOptions?.branchPrefix || 'version-bump'}/v${tree.masterVersion}-${randomSuffix}`;
    this.log.debug({ branch: branchName, version: tree.masterVersion }, 'Creating version branch');

    try {
      // Ensure git user is configured
      await this.configureGit();

      // Create and checkout new branch FIRST (before committing)
      await exec.exec('git', ['checkout', '-b', branchName]);

      // Stage all changes (version files and changelogs)
      await exec.exec('git', ['add', '-A']);

      // Create commit on the new branch
      const commitMessage = `chore: bump version to ${tree.masterVersion}`;
      await exec.exec('git', ['commit', '-m', commitMessage, '--no-verify']);

      // Push the branch
      await exec.exec('git', ['push', '--set-upstream', 'origin', branchName, '--no-verify']);

      this.log.info({ branch: branchName, message: commitMessage }, 'Version branch created and pushed');
      return ok(branchName);
    } catch (error) {
      const gitError = new GitOperationError('createVersionBranch', 'Failed to create version branch', error);
      this.log.error({ error: gitError }, 'Failed to create version branch');
      return err(gitError);
    }
  }

  /**
   * Create version pull request
   *
   * @param tree - Workspace tree
   * @param options - Workflow options
   * @param branchName - The actual branch name (with random suffix)
   * @returns Result with PR number
   */
  async createVersionPR(
    tree: WorkspaceTree,
    options: WorkflowOptions,
    branchName: string,
  ): Promise<Result<number, Error>> {
    this.log.debug({ version: tree.masterVersion, branch: branchName }, 'Creating version PR');

    const title = `chore: bump version to ${tree.masterVersion}`;

    // Build PR body with workspace tree
    const body = PRService.buildPRBody(tree);

    // Create PR
    const prResult = await this.prService.create({
      title,
      body,
      head: branchName,
      base: options.branch || 'main',
      draft: options.prOptions?.draft || false,
    });

    if (!prResult.ok) {
      return err(prResult.error);
    }

    const pr = prResult.value;
    this.log.info({ prNumber: pr.number, prUrl: pr.htmlUrl }, 'Version PR created');

    // Auto-merge if requested
    if (options.prOptions?.autoMerge) {
      // Wait for checks to complete before merging
      this.log.debug({ prNumber: pr.number }, 'Waiting for PR checks to complete');

      const checksResult = await this.prService.waitForChecks({
        prNumber: pr.number,
        timeout: 300000, // 5 minutes
        interval: 10000, // 10 seconds
      });

      if (!checksResult.ok) {
        this.log.error({ prNumber: pr.number, error: checksResult.error.message }, 'Failed to wait for PR checks');
        return err(checksResult.error);
      }

      const checksStatus = checksResult.value;

      if (!checksStatus.allPassed) {
        const checkError = new Error(
          `PR checks did not pass. Failed checks: ${checksStatus.failedCheckNames?.join(', ') || 'unknown'}`,
        );
        this.log.error(
          {
            prNumber: pr.number,
            failedChecks: checksStatus.failedChecks,
            failedCheckNames: checksStatus.failedCheckNames,
            mergeableState: checksStatus.mergeableState,
          },
          'PR checks failed',
        );
        return err(checkError);
      }

      this.log.info({ prNumber: pr.number }, 'All PR checks passed, proceeding with merge');

      const mergeResult = await this.prService.merge({
        prNumber: pr.number,
        mergeMethod: 'squash',
      });

      if (!mergeResult.ok) {
        this.log.warn({ prNumber: pr.number }, 'Auto-merge failed - PR remains open');
      } else {
        this.log.info({ prNumber: pr.number }, 'PR auto-merged');

        // Delete the branch after successful merge to avoid collisions on retry
        try {
          const { owner, repo } = this.prService['github'].getRepository();
          const octokit = this.prService['github'].getOctokit();
          await octokit.rest.git.deleteRef({
            owner,
            repo,
            ref: `heads/${branchName}`,
          });
          this.log.info({ branch: branchName }, 'Version branch deleted after merge');
        } catch (error) {
          this.log.warn({ branch: branchName, error }, 'Failed to delete branch after merge');
        }
      }
    }

    return ok(pr.number);
  }

  /**
   * Create version tags
   *
   * @param tree - Workspace tree
   * @param options - Workflow options
   * @returns Result with created tag names
   */
  async createVersionTags(
    tree: WorkspaceTree,
    options: WorkflowOptions,
    providedCommitSha?: string,
  ): Promise<Result<string[], GitOperationError>> {
    this.log.debug('Creating version tags');

    const createdTags: string[] = [];

    // Use provided SHA or get current branch HEAD SHA
    let commitSha: string;
    if (providedCommitSha) {
      commitSha = providedCommitSha;
      this.log.debug({ commitSha }, 'Using provided commit SHA');
    } else {
      const branch = options.branch || 'main';
      const branchRef = `heads/${branch}`;
      const refResult = await this.gitService.getRef(branchRef);

      if (!refResult.ok) {
        this.log.error({ branch: branchRef }, 'Failed to get current branch HEAD SHA');
        return err(refResult.error);
      }

      commitSha = refResult.value.sha;
      this.log.debug({ commitSha, branch: branchRef }, 'Retrieved current HEAD SHA');
    }

    // Create master version tag
    const masterTag = `v${tree.masterVersion}`;
    const masterTagResult = await this.gitService.createTag({
      tagName: masterTag,
      message: `Release ${tree.masterVersion}`,
      commitSha,
    });

    if (!masterTagResult.ok) {
      return err(masterTagResult.error);
    }

    createdTags.push(masterTag);
    this.log.debug({ tag: masterTag }, 'Master tag created');

    // Create short tag if requested
    if (options.tagOptions?.shortTag) {
      const parts = tree.masterVersion.split('.');
      const shortTag = parts.length >= 2 ? `v${parts[0]}.${parts[1]}` : masterTag;

      if (shortTag !== masterTag) {
        const shortTagResult = await this.gitService.createTag({
          tagName: shortTag,
          message: `Release ${shortTag}`,
          commitSha,
        });

        if (!shortTagResult.ok) {
          this.log.warn({ tag: shortTag }, 'Failed to create short tag');
        } else {
          createdTags.push(shortTag);
          this.log.debug({ tag: shortTag }, 'Short tag created');
        }
      }
    }

    // Only create root/master tag - no workspace-specific tags
    // Workspace-specific tags should only be created if explicitly requested

    this.log.info({ tagCount: createdTags.length, tags: createdTags }, 'Tags created');
    return ok(createdTags);
  }
}
