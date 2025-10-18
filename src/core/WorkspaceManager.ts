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
import { logger } from '../utils/logger.js';
import { parseCommitMessages } from '../parsers/ConventionalCommitParser.js';

const childLogger = logger.child({ service: 'WorkspaceManager' });

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
export class WorkspaceManager {
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
    this.gitService = deps.gitService;
    this.prService = deps.prService;
    this.versionService = deps.versionService;
    this.changelogService = deps.changelogService;
    this.treeBuilder = deps.treeBuilder;

    childLogger.debug('WorkspaceManager initialized');
  }

  /**
   * Execute complete version bumping workflow
   *
   * @param options - Workflow options
   * @returns Result with workflow outcome
   */
  async execute(options: WorkflowOptions): Promise<Result<WorkflowResult, Error>> {
    childLogger.info({ workspaceCount: options.workspaces.length }, 'Starting workflow execution');

    try {
      // Step 1: Get last tag
      const lastTagResult = await this.gitService.getLastTag();
      if (!lastTagResult.ok) {
        return err(lastTagResult.error);
      }
      const lastTag = lastTagResult.value?.name || null;
      childLogger.info({ lastTag }, 'Last tag retrieved');

      // Step 2: Enrich workspaces
      const enrichResult = await this.enrichWorkspaces(options.workspaces);
      if (!enrichResult.ok) {
        return err(enrichResult.error);
      }
      const enrichedWorkspaces = enrichResult.value;
      childLogger.info({ count: enrichedWorkspaces.length }, 'Workspaces enriched');

      // Step 3: Detect changed workspaces
      const changedResult = await this.detectChangedWorkspaces(enrichedWorkspaces, lastTag);
      if (!changedResult.ok) {
        return err(changedResult.error);
      }
      const changedWorkspaces = changedResult.value;

      if (changedWorkspaces.length === 0) {
        childLogger.info('No workspaces have changed - skipping version bump');
        // Return empty result - no work needed
        return err(new WorkspaceValidationError('No workspaces have changed since last tag'));
      }

      childLogger.info({ count: changedWorkspaces.length }, 'Changed workspaces detected');

      // Step 4: Calculate new versions
      const versionsResult = await this.calculateVersions(changedWorkspaces, lastTag);
      if (!versionsResult.ok) {
        return err(versionsResult.error);
      }
      const workspacesWithVersions = versionsResult.value;
      childLogger.info('New versions calculated');

      // Step 5: Build workspace tree
      const tree = this.treeBuilder.build(workspacesWithVersions);
      childLogger.info({ rootVersion: tree.masterVersion }, 'Workspace tree built');

      // Step 6: Update version files
      const updateResult = await this.updateVersionFiles(workspacesWithVersions);
      if (!updateResult.ok) {
        return err(updateResult.error);
      }
      childLogger.info('Version files updated');

      // Step 7: Generate changelogs
      const changelogResult = await this.generateChangelogs(tree, options);
      if (!changelogResult.ok) {
        return err(changelogResult.error);
      }
      childLogger.info('Changelogs generated');

      // Step 8: Create PR or commit
      let prNumber: number | undefined;
      if (options.createPR) {
        const prResult = await this.createVersionPR(tree, options);
        if (!prResult.ok) {
          return err(prResult.error);
        }
        prNumber = prResult.value;
        childLogger.info({ prNumber }, 'Pull request created');
      } else {
        const commitResult = await this.createVersionCommit(tree);
        if (!commitResult.ok) {
          return err(commitResult.error);
        }
        childLogger.info({ sha: commitResult.value }, 'Version commit created');
      }

      // Step 9: Create tags
      const tagsResult = await this.createVersionTags(tree, options);
      if (!tagsResult.ok) {
        return err(tagsResult.error);
      }
      const allTags = tagsResult.value;
      childLogger.info({ tagCount: allTags.length }, 'Version tags created');

      const result: WorkflowResult = {
        tag: `v${tree.masterVersion}`,
        allTags,
        prNumber,
        tree,
      };

      childLogger.info({ tag: result.tag }, 'Workflow completed successfully');
      return ok(result);
    } catch (error) {
      childLogger.error({ error }, 'Workflow execution failed');
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
    childLogger.debug({ count: configs.length }, 'Enriching workspaces');

    const enriched: Workspace[] = [];

    for (const config of configs) {
      const adapter = getAdapter(config.type);
      const detectResult = await adapter.detect(config.path);

      if (!detectResult.ok) {
        childLogger.error({ path: config.path, type: config.type }, 'Failed to detect workspace info');
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
      childLogger.debug({ path: config.path, name: info.name, version: info.version }, 'Workspace enriched');
    }

    return ok(enriched);
  }

  /**
   * Detect workspaces with changes since last tag
   *
   * @param workspaces - Enriched workspaces
   * @param lastTag - Last git tag
   * @returns Result with changed workspaces
   */
  async detectChangedWorkspaces(
    workspaces: ReadonlyArray<Workspace>,
    lastTag: string | null,
  ): Promise<Result<ReadonlyArray<Workspace>, GitOperationError>> {
    childLogger.debug({ lastTag }, 'Detecting changed workspaces');

    // If no last tag, all workspaces are considered changed
    if (!lastTag) {
      childLogger.info('No previous tag - all workspaces marked as changed');
      return ok(
        workspaces.map((w) => ({
          ...w,
          hasChanges: true,
          changedFiles: ['*'], // Indicate all files changed
        })),
      );
    }

    // Get changed files since last tag
    const changedFilesResult = await this.gitService.getChangedFiles(lastTag, 'HEAD');
    if (!changedFilesResult.ok) {
      return err(changedFilesResult.error);
    }

    const allChangedFiles = changedFilesResult.value.files;
    childLogger.debug({ fileCount: allChangedFiles.length }, 'Changed files retrieved');

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

      return {
        ...workspace,
        hasChanges: changedInWorkspace.length > 0,
        changedFiles: changedInWorkspace.map((f) => f.path),
      };
    });

    const changedWorkspaces = updated.filter((w) => w.hasChanges);
    childLogger.debug({ changedCount: changedWorkspaces.length }, 'Changed workspaces identified');

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
    childLogger.debug('Calculating new versions');

    // Get commits since last tag (use HEAD^ if no tag to get at least one commit)
    const base = lastTag || 'HEAD^';
    const commitsResult = await this.gitService.getCommitsSince(base);
    if (!commitsResult.ok) {
      return err(commitsResult.error);
    }

    const commits = commitsResult.value;
    const commitMessages = commits.map((c) => c.message);

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
        childLogger.debug(
          { workspace: workspace.path, oldVersion: workspace.version, newVersion, bumpType: analysis.type },
          'Version calculated from commits',
        );
      } else {
        // No conventional commits - default to patch bump
        newVersion = this.versionService.increaseVersion(workspace.version, 'patch');
        childLogger.debug(
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
    childLogger.debug({ count: workspaces.length }, 'Updating version files');

    for (const workspace of workspaces) {
      const adapter = getAdapter(workspace.type);
      const updateResult = await adapter.update(workspace.path, workspace.newVersion);

      if (!updateResult.ok) {
        childLogger.error({ path: workspace.path, version: workspace.newVersion }, 'Failed to update version file');
        return err(updateResult.error);
      }

      childLogger.debug({ path: workspace.path, version: workspace.newVersion }, 'Version file updated');
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
    childLogger.debug('Generating changelogs');

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

    childLogger.debug({ path: rootChangelogPath }, 'Root changelog generated');

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

      childLogger.debug({ path: changelogPath }, 'Workspace changelog generated');

      // Recurse to children
      if (node.children.length > 0) {
        await this.generateChangelogsRecursive(node.children, options);
      }
    }
  }

  /**
   * Create version commit
   *
   * @param tree - Workspace tree
   * @returns Result with commit SHA
   */
  async createVersionCommit(tree: WorkspaceTree): Promise<Result<string, GitOperationError>> {
    childLogger.debug({ version: tree.masterVersion }, 'Creating version commit');

    // Note: Actual commit creation would require staging files via Git CLI
    // or using GitHub API to create a tree and commit
    // For now, return a placeholder - this will be implemented in integration
    childLogger.warn('Direct commit creation not yet implemented - use PR workflow');
    return err(new GitOperationError('createVersionCommit', 'Direct commit not implemented - use PR workflow'));
  }

  /**
   * Create version pull request
   *
   * @param tree - Workspace tree
   * @param options - Workflow options
   * @returns Result with PR number
   */
  async createVersionPR(tree: WorkspaceTree, options: WorkflowOptions): Promise<Result<number, Error>> {
    childLogger.debug({ version: tree.masterVersion }, 'Creating version PR');

    const branchName = `${options.prOptions?.branchPrefix || 'version-bump'}/v${tree.masterVersion}`;
    const title = `chore: bump version to ${tree.masterVersion}`;

    // Build PR body with workspace tree
    const body = PRService.buildPRBody(tree);

    // Create PR
    const prResult = await this.prService.create({
      title,
      body,
      head: branchName,
      base: 'main',
      draft: options.prOptions?.draft || false,
    });

    if (!prResult.ok) {
      return err(prResult.error);
    }

    const pr = prResult.value;
    childLogger.info({ prNumber: pr.number, prUrl: pr.htmlUrl }, 'Version PR created');

    // Auto-merge if requested
    if (options.prOptions?.autoMerge) {
      const mergeResult = await this.prService.merge({
        prNumber: pr.number,
        mergeMethod: 'squash',
      });

      if (!mergeResult.ok) {
        childLogger.warn({ prNumber: pr.number }, 'Auto-merge failed - PR remains open');
      } else {
        childLogger.info({ prNumber: pr.number }, 'PR auto-merged');
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
  async createVersionTags(tree: WorkspaceTree, options: WorkflowOptions): Promise<Result<string[], GitOperationError>> {
    childLogger.debug('Creating version tags');

    const createdTags: string[] = [];

    // Get current HEAD SHA from last tag or use placeholder
    // In real implementation, this would get the actual HEAD SHA
    const commitSha = 'HEAD'; // Placeholder - will be resolved by Git API

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
    childLogger.debug({ tag: masterTag }, 'Master tag created');

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
          childLogger.warn({ tag: shortTag }, 'Failed to create short tag');
        } else {
          createdTags.push(shortTag);
          childLogger.debug({ tag: shortTag }, 'Short tag created');
        }
      }
    }

    // Create workspace-specific tags
    for (const workspace of tree.allWorkspaces) {
      if (workspace.path !== '.') {
        const workspaceTag = `${workspace.path}@v${workspace.newVersion}`;
        const workspaceTagResult = await this.gitService.createTag({
          tagName: workspaceTag,
          message: `Release ${workspace.name} ${workspace.newVersion}`,
          commitSha,
        });

        if (!workspaceTagResult.ok) {
          childLogger.warn({ tag: workspaceTag, workspace: workspace.path }, 'Failed to create workspace tag');
        } else {
          createdTags.push(workspaceTag);
          childLogger.debug({ tag: workspaceTag }, 'Workspace tag created');
        }
      }
    }

    childLogger.info({ tagCount: createdTags.length, tags: createdTags }, 'All tags created');
    return ok(createdTags);
  }
}
