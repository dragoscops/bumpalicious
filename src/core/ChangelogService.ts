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
 * Parsed commit for changelog generation
 */
export interface ParsedCommit {
  /** Commit message */
  readonly message: string;
  /** Commit SHA */
  readonly sha: string;
  /** Commit author name */
  readonly author?: string;
  /** Commit date */
  readonly date?: string;
}

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
  /** Last git tag to generate changelog from (optional, for incremental changelogs) */
  readonly lastTag?: string | null;
  /** Commits to include in changelog (instead of reading from git) */
  readonly commits?: ReadonlyArray<ParsedCommit>;
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
          lastTag: options.lastTag,
          hasCommits: !!options.commits,
          commitCount: options.commits?.length || 0,
        },
        'Generating changelog content',
      );
      const newContent = await this.generateChangelogContent({
        workspace,
        preset,
        repository,
        lastTag: options.lastTag,
        commits: options.commits,
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
      const errorDetails = {
        workspace: workspace.path,
        changelogPath,
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        commitCount: options.commits?.length || 0,
        hasRepository: !!repository,
        preset,
      };
      this.log.error(errorDetails, 'Failed to generate changelog');
      throw new FileOperationError(
        changelogPath,
        'generate',
        `Failed to generate changelog for ${workspace.path}: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /**
   * Generate changelog content using conventional-changelog ecosystem
   *
   * Modular approach:
   * 1. Takes commits from GitService (you control the data)
   * 2. Parses them with conventional-commits-parser
   * 3. Formats with conventional-changelog-writer
   *
   * No git access needed - everything is controlled by you!
   *
   * @param options - Generation options
   * @returns Generated changelog content
   * @private
   */
  private async generateChangelogContent(options: {
    workspace: WorkspaceWithVersion;
    preset: ChangelogPreset;
    repository?: { owner: string; repo: string };
    lastTag?: string | null;
    commits?: ReadonlyArray<ParsedCommit>;
  }): Promise<string> {
    const { workspace, preset, repository, lastTag, commits = [] } = options;

    this.log.debug(
      {
        workspace: workspace.path,
        preset,
        lastTag,
        commitCount: commits.length,
      },
      'Generating changelog with modular approach',
    );

    // If no commits provided, generate a basic changelog entry
    if (commits.length === 0) {
      this.log.debug({ workspace: workspace.path }, 'No commits provided, generating basic changelog entry');
      const date = new Date().toISOString().split('T')[0];
      return `\n## ${workspace.newVersion} (${date})\n\n`;
    }

    // Import the modules we need
    const { writeChangelogString } = await import('conventional-changelog-writer');
    const { parseCommits } = await import('conventional-commits-parser');
    const getPresetConfig = await import('conventional-changelog-conventionalcommits');

    // Get preset configuration (writer options + parser options)
    const presetConfig = await getPresetConfig.default();

    // In production (GitHub Actions), templates are copied to dist/templates
    // In development, they're in node_modules
    const isProduction = process.env.NODE_ENV === 'production' || process.env.GITHUB_ACTIONS === 'true';
    const templatesPath = isProduction
      ? path.join(process.cwd(), 'dist', 'templates')
      : path.join(process.cwd(), 'node_modules', 'conventional-changelog-conventionalcommits', 'src', 'templates');

    this.log.debug({ templatesPath, isProduction, cwd: process.cwd() }, 'Using templates path');

    // Load template files as strings to avoid file path resolution issues in bundled code
    const mainTemplate = await fs.readFile(path.join(templatesPath, 'template.hbs'), 'utf-8');
    const headerPartial = await fs.readFile(path.join(templatesPath, 'header.hbs'), 'utf-8');
    const commitPartial = await fs.readFile(path.join(templatesPath, 'commit.hbs'), 'utf-8');
    const footerPartial = await fs.readFile(path.join(templatesPath, 'footer.hbs'), 'utf-8');
    this.log.debug('Templates loaded as strings');

    // Override writerOpts completely - provide templates as strings, not file paths
    if (presetConfig?.writerOpts) {
      presetConfig.writerOpts.mainTemplate = mainTemplate;
      presetConfig.writerOpts.headerPartial = headerPartial;
      presetConfig.writerOpts.commitPartial = commitPartial;
      presetConfig.writerOpts.footerPartial = footerPartial;
      // Remove any file path references that might be in the preset
      delete (presetConfig.writerOpts as Record<string, unknown>).templatePath;
      this.log.debug('Templates injected into writer options');
    }

    // Build context for link generation
    const context = {
      version: workspace.newVersion,
      ...(repository && {
        host: 'https://github.com',
        owner: repository.owner,
        repository: repository.repo,
        linkCompare: true,
      }),
    };

    this.log.debug({ context, commitCount: commits.length }, 'Context prepared');

    // Parse commits using parseCommits which accepts an array of strings
    const commitMessages = commits.map((c) => c.message);
    this.log.debug({ commitMessages, commitCount: commitMessages.length }, 'Commit messages extracted');

    // parseCommits() returns a parser function that accepts an array and returns an async iterable
    const parser = parseCommits();
    this.log.debug('Parser function created');

    const parsedCommitsIterable = parser(commitMessages);
    this.log.debug({ iterableType: typeof parsedCommitsIterable }, 'Parser iterable created');

    // Collect parsed commits and enrich with SHA/date
    const parsedCommits: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    let index = 0;

    try {
      for await (const parsed of parsedCommitsIterable) {
        this.log.debug({ index, parsed, originalCommit: commits[index] }, 'Processing parsed commit');
        parsedCommits.push({
          ...parsed,
          hash: commits[index].sha,
          committerDate: commits[index].date,
        });
        index++;
      }
    } catch (parseError) {
      this.log.error({ parseError, index, commitCount: commits.length }, 'Error parsing commits');
      throw parseError;
    }

    this.log.debug({ parsedCount: parsedCommits.length }, 'Commits parsed');

    // Generate markdown using writer
    this.log.debug({ parsedCommits, context, hasPresetConfig: !!presetConfig }, 'About to generate changelog string');
    try {
      const changelog = await writeChangelogString(parsedCommits, context, presetConfig);
      this.log.debug({ length: changelog.length, preview: changelog.substring(0, 200) }, 'Changelog generated');
      return changelog;
    } catch (writeError) {
      this.log.error({ writeError, parsedCommits, context }, 'Error writing changelog string');
      throw writeError;
    }
  } /**
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
