/**
 * Changelog Service
 *
 * Generates and manages CHANGELOG.md files using conventional-changelog.
 * Supports multiple preset formats and child workspace summaries for monorepos.
 *
 * Features:
 * - Generate changelog from conventional commits
 * - Create CHANGELOG.md if missing
 * - Prepend new entries to existing changelog
 * - Support multiple preset formats (conventionalcommits, angular, etc.)
 * - Append child workspace summary for root workspaces
 *
 * Usage:
 * ```typescript
 * const service = new ChangelogService();
 *
 * // Generate changelog for a workspace
 * const changelog = await service.generateForWorkspace({
 *   workspace: myWorkspace,
 *   changelogPath: './CHANGELOG.md',
 *   preset: 'conventionalcommits'
 * });
 * ```
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Version } from '../types/version.js';
import type { WorkspaceWithVersion, WorkspaceNode } from '../types/workspace.js';
import { FileOperationError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';

/**
 * Preset formats for conventional-changelog
 */
export type ChangelogPreset =
  | 'conventionalcommits'
  | 'angular'
  | 'atom'
  | 'codemirror'
  | 'ember'
  | 'eslint'
  | 'express'
  | 'jquery'
  | 'jshint';

/**
 * Options for changelog generation
 */
export interface GenerateChangelogOptions {
  /** Workspace to generate changelog for */
  readonly workspace: WorkspaceWithVersion;
  /** Path to CHANGELOG.md file */
  readonly changelogPath: string;
  /** Conventional changelog preset */
  readonly preset?: ChangelogPreset;
  /** Child workspace nodes (for root workspace summary) */
  readonly childWorkspaces?: ReadonlyArray<WorkspaceNode>;
  /** Repository context (owner/repo) */
  readonly repository?: {
    readonly owner: string;
    readonly repo: string;
  };
}

/**
 * Result of changelog generation
 */
export interface ChangelogResult {
  /** Generated changelog content */
  readonly content: string;
  /** Path where changelog was written */
  readonly path: string;
  /** Whether changelog was created (true) or updated (false) */
  readonly created: boolean;
}

/**
 * Changelog Service for generating CHANGELOG.md files
 */
export class ChangelogService extends Loggable {
  /**
   * Create a new Changelog Service instance
   */
  constructor() {
    super();
    this.log.info('ChangelogService initialized');
  }
  /**
   * Generate changelog for a workspace
   *
   * Algorithm:
   * 1. Generate changelog content using conventional-changelog-core
   * 2. Read existing changelog (if exists)
   * 3. Prepend new content to existing changelog
   * 4. For root workspace, append child workspace summary
   * 5. Write updated changelog to file
   *
   * @param options - Changelog generation options
   * @returns Changelog result with content and metadata
   * @throws {FileOperationError} if changelog generation fails
   *
   * @example
   * ```typescript
   * const result = await service.generateForWorkspace({
   *   workspace: myWorkspace,
   *   changelogPath: './CHANGELOG.md',
   *   preset: 'conventionalcommits'
   * });
   * console.log(result.content); // Full changelog content
   * ```
   */
  async generateForWorkspace(options: GenerateChangelogOptions): Promise<ChangelogResult> {
    const { workspace, changelogPath, preset = 'conventionalcommits', childWorkspaces = [], repository } = options;

    this.log.debug(
      {
        workspace: workspace.path,
        version: workspace.newVersion,
        changelogPath,
        preset,
        hasChildWorkspaces: childWorkspaces.length > 0,
        childWorkspacesCount: childWorkspaces.length,
      },
      'Generating changelog',
    );

    try {
      // Check if changelog exists
      const changelogExists = await this.fileExists(changelogPath);
      this.log.debug(
        {
          changelogPath,
          exists: changelogExists,
        },
        'Checked changelog existence',
      );

      // Read existing changelog
      const existingChangelog = changelogExists ? await fs.readFile(changelogPath, 'utf-8') : '';
      if (changelogExists) {
        this.log.debug(
          {
            changelogPath,
            existingLength: existingChangelog.length,
          },
          'Read existing changelog',
        );
      }

      // Generate new changelog content
      this.log.debug(
        {
          workspace: workspace.path,
          preset,
        },
        'Generating changelog content',
      );
      const newContent = await this.generateChangelogContent({
        workspace,
        preset,
        repository,
      });

      // Merge new content with existing changelog
      let finalContent = this.mergeChangelogs(newContent, existingChangelog);

      // Append child workspace summary for root workspace
      if (childWorkspaces.length > 0) {
        const childSummary = this.generateChildWorkspaceSummary(childWorkspaces);
        finalContent = this.appendChildSummary(finalContent, childSummary, workspace.newVersion);
      }

      // Write changelog to file
      await this.writeChangelog(changelogPath, finalContent);

      this.log.info(
        {
          workspace: workspace.path,
          changelogPath,
          created: !changelogExists,
          contentLength: finalContent.length,
        },
        'Changelog generated successfully',
      );

      return {
        content: finalContent,
        path: changelogPath,
        created: !changelogExists,
      };
    } catch (error) {
      this.log.error(
        {
          workspace: workspace.path,
          changelogPath,
          error,
        },
        'Failed to generate changelog',
      );
      throw new FileOperationError(
        changelogPath,
        'generate',
        `Failed to generate changelog for ${workspace.path}`,
        error,
      );
    }
  }

  /**
   * Generate changelog content using conventional-changelog-core
   *
   * @param options - Generation options
   * @returns Generated changelog content
   * @private
   */
  private async generateChangelogContent(options: {
    workspace: WorkspaceWithVersion;
    preset: ChangelogPreset;
    repository?: { owner: string; repo: string };
  }): Promise<string> {
    const { workspace, preset, repository } = options;

    // Dynamically import conventional-changelog-core (ESM module)
    const { default: conventionalChangelogCore } = await import('conventional-changelog-core');

    // Dynamically import preset config function
    const presetConfigFn = await this.loadPresetConfig(preset);

    const tagPrefix = workspace.path === '.' ? 'v' : `${workspace.path}@v`;

    // Configure repository context for link generation
    const context = repository
      ? {
          version: workspace.newVersion,
          currentTag: `${tagPrefix}${workspace.newVersion}`,
          previousTag: `${tagPrefix}${workspace.version}`,
          host: 'https://github.com',
          owner: repository.owner,
          repository: repository.repo,
          repoUrl: `https://github.com/${repository.owner}/${repository.repo}`,
          linkCompare: true,
          linkReferences: true,
        }
      : {
          version: workspace.newVersion,
          currentTag: `${tagPrefix}${workspace.newVersion}`,
          previousTag: `${tagPrefix}${workspace.version}`,
        };

    this.log.debug({ context }, 'Changelog generation context');

    // Call preset config function - it returns a promise of the config
    const resolvedConfig = await presetConfigFn();

    return new Promise<string>((resolve, reject) => {
      let changelog = '';

      const changelogStream = conventionalChangelogCore(
        {
          config: resolvedConfig as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          releaseCount: 1,
        },
        context,
        {
          path: workspace.path === '.' ? undefined : workspace.path,
          from: `${tagPrefix}${workspace.version}`,
        },
      );

      changelogStream.on('data', (chunk: Buffer) => {
        changelog += chunk.toString();
      });

      changelogStream.on('end', () => {
        resolve(changelog);
      });

      changelogStream.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * Load preset configuration dynamically
   *
   * @param preset - Preset name
   * @returns Preset configuration
   * @private
   */
  private async loadPresetConfig(preset: ChangelogPreset): Promise<() => Promise<unknown>> {
    try {
      // Import preset module dynamically
      const presetModule = (await import(`conventional-changelog-${preset}`)) as { default: () => Promise<unknown> };
      return presetModule.default;
    } catch {
      // Fallback to conventionalcommits if preset not found
      const conventionalcommits = (await import('conventional-changelog-conventionalcommits')) as {
        default: () => Promise<unknown>;
      };
      return conventionalcommits.default;
    }
  }

  /**
   * Merge new changelog content with existing content
   *
   * Prepends new content to existing changelog, preserving header.
   *
   * @param newContent - Newly generated changelog content
   * @param existingContent - Existing changelog content
   * @returns Merged changelog content
   * @private
   */
  private mergeChangelogs(newContent: string, existingContent: string): string {
    if (!existingContent) {
      // No existing changelog, return new content with header
      return this.ensureChangelogHeader(newContent);
    }

    // Extract header from existing changelog (everything before first version heading)
    const versionHeadingRegex = /^#{1,3}\s+\[?\d+\.\d+\.\d+/m;
    const headerMatch = existingContent.match(new RegExp(`^([\\s\\S]*?)(?=${versionHeadingRegex.source})`, 'm'));
    const existingHeader = headerMatch ? headerMatch[1].trim() : '';

    // Extract body from existing changelog (everything from first version heading)
    const bodyMatch = existingContent.match(new RegExp(`(${versionHeadingRegex.source}[\\s\\S]*)`, 'm'));
    const existingBody = bodyMatch ? bodyMatch[1] : existingContent;

    // Remove header from new content if present
    const newContentWithoutHeader = newContent.replace(/^#\s+.*?\n+/m, '').trim();

    // Merge: header + new content + existing body
    const header = existingHeader || '# Changelog\n';
    return `${header}\n\n${newContentWithoutHeader}\n\n${existingBody}`.trim() + '\n';
  }

  /**
   * Ensure changelog has proper header
   *
   * @param content - Changelog content
   * @returns Content with header
   * @private
   */
  private ensureChangelogHeader(content: string): string {
    if (content.startsWith('# Changelog') || content.startsWith('# CHANGELOG')) {
      return content;
    }
    return `# Changelog\n\n${content}`;
  }

  /**
   * Generate child workspace summary section
   *
   * Creates markdown section listing all child workspaces with their versions.
   *
   * @param childWorkspaces - Child workspace nodes
   * @returns Markdown summary of child workspaces
   * @private
   */
  private generateChildWorkspaceSummary(childWorkspaces: ReadonlyArray<WorkspaceNode>): string {
    const lines: string[] = ['### Child Workspaces', '', 'The following workspaces are included in this release:', ''];

    // Recursively collect all workspaces
    const allChildren: WorkspaceWithVersion[] = [];
    const collectWorkspaces = (nodes: ReadonlyArray<WorkspaceNode>) => {
      for (const node of nodes) {
        allChildren.push(node.workspace);
        if (node.children.length > 0) {
          collectWorkspaces(node.children);
        }
      }
    };
    collectWorkspaces(childWorkspaces);

    // Sort by path for consistent output
    const sortedChildren = [...allChildren].sort((a, b) => a.path.localeCompare(b.path));

    // Format as markdown list
    for (const workspace of sortedChildren) {
      const changeIndicator = workspace.hasChanges ? '🔄' : '✓';
      lines.push(`- ${changeIndicator} \`${workspace.path}\` - v${workspace.newVersion}`);
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Append child workspace summary to changelog
   *
   * Inserts the child summary after the version heading.
   *
   * @param content - Changelog content
   * @param summary - Child workspace summary
   * @param version - Version to append summary to
   * @returns Changelog with appended summary
   * @private
   */
  private appendChildSummary(content: string, summary: string, version: Version): string {
    // Find the version heading for the new version
    const versionHeadingRegex = new RegExp(`^(#{1,3}\\s+\\[?${version.replace(/\./g, '\\.')}[^\\n]*\\n)`, 'm');
    const match = content.match(versionHeadingRegex);

    if (!match) {
      // If no version heading found, append at the beginning
      return `${summary}\n${content}`;
    }

    // Insert summary after the version heading
    const headingEndIndex = match.index! + match[0].length;
    return content.slice(0, headingEndIndex) + '\n' + summary + '\n' + content.slice(headingEndIndex);
  }

  /**
   * Write changelog to file
   *
   * Creates directory if it doesn't exist.
   *
   * @param changelogPath - Path to changelog file
   * @param content - Changelog content
   * @private
   */
  private async writeChangelog(changelogPath: string, content: string): Promise<void> {
    const dir = path.dirname(changelogPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(changelogPath, content, 'utf-8');
  }

  /**
   * Check if file exists
   *
   * @param filePath - Path to file
   * @returns True if file exists
   * @private
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
