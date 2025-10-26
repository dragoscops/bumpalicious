/**
 * Workspace Service
 *
 * Handles workspace-related operations:
 * - Enriching workspace configs with detected metadata
 * - Detecting changed workspaces since last tag
 * - Matching files to workspaces
 */

import type { GitService } from './GitService.js';
import { getAdapter } from '../core/adapters/AdapterFactory.js';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import type { WorkspaceConfig, Workspace } from '../types/workspace.js';
import { WorkspaceDetectionError, GitOperationError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';

/**
 * Workspace Service
 *
 * Manages workspace detection and change tracking
 */
export class WorkspaceService extends Loggable {
  private readonly gitService: GitService;

  constructor(gitService: GitService) {
    super();
    this.gitService = gitService;
    this.log.info('WorkspaceService initialized');
  }

  /**
   * Enrich workspace configs with detected name and version
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
      const absolutePath = this.resolveAbsolutePath(config.path);

      const workspace: Workspace = {
        ...config,
        path: absolutePath,
        name: info.name,
        version: info.version,
        hasChanges: false,
        changedFiles: [],
      };

      enriched.push(workspace);
      this.log.debug(
        {
          originalPath: config.path,
          absolutePath,
          name: info.name,
          version: info.version,
        },
        'Workspace enriched',
      );
    }

    return ok(enriched);
  }

  /**
   * Detect workspaces with changes since last tag
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
          changedFiles: ['*'],
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
    const updated = this.matchFilesToWorkspaces(workspaces, allChangedFiles);

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
   * Match changed files to workspaces
   */
  private matchFilesToWorkspaces(
    workspaces: ReadonlyArray<Workspace>,
    allChangedFiles: ReadonlyArray<{ path: string }>,
  ): Workspace[] {
    const cwd = process.cwd();

    return workspaces.map((workspace) => {
      const relativePath = workspace.path === cwd ? '.' : workspace.path.replace(`${cwd}/`, '');
      const workspacePath = relativePath === '.' ? '' : relativePath;

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
  }

  /**
   * Resolve workspace path to absolute path
   */
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
