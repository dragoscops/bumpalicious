/** Workspace service for enrichment and change detection */

import type { GitService } from './GitService.js';
import { getAdapter } from '../core/adapters/AdapterFactory.js';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import type { WorkspaceConfig, Workspace } from '../types/workspace.js';
import { WorkspaceDetectionError, GitOperationError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';

/** Workspace service for enrichment and change detection */
export class WorkspaceService extends Loggable {
  private readonly gitService: GitService;

  constructor(gitService: GitService) {
    super();
    this.gitService = gitService;
    this.log.info('WorkspaceService initialized');
  }

  // ====================
  // Public API
  // ====================

  /** Enrich workspace configs with detected metadata */
  async enrichWorkspaces(
    configs: ReadonlyArray<WorkspaceConfig>,
  ): Promise<Result<ReadonlyArray<Workspace>, WorkspaceDetectionError>> {
    this.log.debug({ count: configs.length }, 'Enriching workspaces');

    const enriched: Workspace[] = [];

    for (const config of configs) {
      const result = await this.enrichSingleWorkspace(config);
      if (!result.ok) {
        return err(result.error);
      }
      enriched.push(result.value);
    }

    return ok(enriched);
  }

  /** Detect workspaces with changes since last tag */
  async detectChangedWorkspaces(
    workspaces: ReadonlyArray<Workspace>,
    lastTag: string | null,
    branch: string = 'main',
  ): Promise<Result<ReadonlyArray<Workspace>, GitOperationError>> {
    this.log.debug({ lastTag, branch, workspaceCount: workspaces.length }, 'Detecting changed workspaces');

    if (!lastTag) {
      return this.markAllAsChanged(workspaces);
    }

    const changedFilesResult = await this.gitService.getChangedFiles(lastTag, branch);
    if (!changedFilesResult.ok) {
      return err(changedFilesResult.error);
    }

    const allChangedFiles = changedFilesResult.value.files;
    this.log.debug({ fileCount: allChangedFiles.length }, 'Changed files retrieved');

    const updated = this.matchFilesToWorkspaces(workspaces, allChangedFiles);
    const changedWorkspaces = updated.filter((w) => w.hasChanges);

    this.log.info(
      { changedCount: changedWorkspaces.length, totalWorkspaces: workspaces.length },
      'Changed workspaces identified',
    );

    return ok(changedWorkspaces);
  }

  // ====================
  // Workspace Enrichment
  // ====================

  /** Enrich single workspace config */
  private async enrichSingleWorkspace(config: WorkspaceConfig): Promise<Result<Workspace, WorkspaceDetectionError>> {
    const adapter = getAdapter(config.type);
    const detectResult = await adapter.detect(config.path);

    if (!detectResult.ok) {
      this.log.error({ path: config.path, type: config.type }, 'Failed to detect workspace info');
      return err(detectResult.error);
    }

    const info = detectResult.value;
    const absolutePath = this.resolveAbsolutePath(config.path);

    const workspace: Workspace = {
      ...config,
      path: absolutePath,
      name: info.name,
      version: info.version,
      hasChanges: false,
      changedFiles: [],
    };

    this.log.debug({ path: config.path, name: info.name, version: info.version }, 'Workspace enriched');
    return ok(workspace);
  }

  // ====================
  // Change Detection
  // ====================

  /** Mark all workspaces as changed */
  private markAllAsChanged(workspaces: ReadonlyArray<Workspace>): Result<ReadonlyArray<Workspace>, GitOperationError> {
    this.log.info('No previous tag - all workspaces marked as changed');
    return ok(
      workspaces.map((w) => ({
        ...w,
        hasChanges: true,
        changedFiles: ['*'],
      })),
    );
  }

  /** Match changed files to workspaces */
  private matchFilesToWorkspaces(
    workspaces: ReadonlyArray<Workspace>,
    allChangedFiles: ReadonlyArray<{ path: string }>,
  ): Workspace[] {
    return workspaces.map((workspace) => {
      const workspacePath = this.getRelativePath(workspace.path);
      const changedInWorkspace = this.filterFilesForWorkspace(allChangedFiles, workspacePath);

      this.log.debug(
        { workspace: workspace.name, workspacePath, matchedFiles: changedInWorkspace.length },
        'Workspace file matching',
      );

      return {
        ...workspace,
        hasChanges: changedInWorkspace.length > 0,
        changedFiles: changedInWorkspace.map((f) => f.path),
      };
    });
  }

  // ====================
  // Helpers
  // ====================

  /** Get relative path from absolute workspace path */
  private getRelativePath(absolutePath: string): string {
    const cwd = process.cwd();
    if (absolutePath === cwd) {
      return '';
    }
    const relativePath = absolutePath.replace(`${cwd}/`, '');
    return relativePath === '.' ? '' : relativePath;
  }

  /** Filter files that belong to workspace */
  private filterFilesForWorkspace(
    files: ReadonlyArray<{ path: string }>,
    workspacePath: string,
  ): Array<{ path: string }> {
    if (workspacePath === '') {
      // Root workspace - all files belong to it
      return [...files];
    }

    // Child workspace - only files within its path
    return files.filter((file) => file.path.startsWith(workspacePath + '/') || file.path === workspacePath);
  }

  /** Resolve workspace path to absolute path */
  private resolveAbsolutePath(configPath: string): string {
    if (configPath === '.') {
      return process.cwd();
    }
    if (configPath.startsWith('/')) {
      return configPath;
    }
    return `${process.cwd()}/${configPath}`;
  }
}
