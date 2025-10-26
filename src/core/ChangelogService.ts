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
import { Readable } from 'node:stream';

// Import all preset factories statically so Rollup can bundle them
import angularPreset from 'conventional-changelog-angular';
import atomPreset from 'conventional-changelog-atom';
import codemirrorPreset from 'conventional-changelog-codemirror';
import conventionalcommitsPreset from 'conventional-changelog-conventionalcommits';
import emberPreset from 'conventional-changelog-ember';
import eslintPreset from 'conventional-changelog-eslint';
import expressPreset from 'conventional-changelog-express';
import jqueryPreset from 'conventional-changelog-jquery';
import jshintPreset from 'conventional-changelog-jshint';
import { GitCommit } from '../types/git.js';
import type { Version } from '../types/version.js';
import type { WorkspaceWithVersion, WorkspaceNode } from '../types/workspace.js';
import { Loggable } from '../utils/Loggable.js';

/**
 * Map of preset names to their factory functions
 * Using static imports so Rollup can bundle them properly
 */
const PRESET_MAP = {
  angular: angularPreset,
  atom: atomPreset,
  codemirror: codemirrorPreset,
  conventionalcommits: conventionalcommitsPreset,
  ember: emberPreset,
  eslint: eslintPreset,
  express: expressPreset,
  jquery: jqueryPreset,
  jshint: jshintPreset,
} as const;

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
 * TODO: make all readonly
 * The commits that come out of conventional-commits-parser have a known-ish shape,
 * but types aren't exported in a super helpful way from that package.
 *
 * We'll declare a minimal interface for what writer() cares about.
 * (writer() expects objects with fields like type, scope, subject, notes, etc.)
 */
interface ParsedCommit {
  type?: string;
  scope?: string;
  subject?: string;
  body?: string;
  footer?: string;
  hash?: string;
  notes?: Array<{
    title: string;
    text: string;
  }>;
  [key: string]: unknown;
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
  readonly repository: {
    readonly owner: string;
    readonly repo: string;
  };
  /** Last git tag to generate changelog from (optional, for incremental changelogs) */
  readonly lastTag?: string | null;
  /** Commits to include in changelog (instead of reading from git) */
  readonly commits?: ReadonlyArray<GitCommit>;
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
 * Load template files for a preset
 * Automatically detects whether to use bundled templates or node_modules templates
 *
 * @param preset - The conventional-changelog preset name
 * @returns Template strings for main, header, commit, and footer
 */
async function loadTemplates(preset: ChangelogPreset): Promise<{
  template: string;
  header: string;
  commit: string;
  footer?: string;
}> {
  // Try bundled path first (GitHub Actions / production)
  const bundledPath = path.join(__dirname, 'templates', preset);

  // Fallback to node_modules path (development)
  const devPath = path.join(
    __dirname,
    '..',
    '..',
    'node_modules',
    `conventional-changelog-${preset}`,
    'src',
    'templates',
  );

  // Try bundled path first, fallback to dev path
  let template: string;
  let header: string;
  let commit: string;
  let footer: string = '';

  try {
    // Try reading from bundled location
    const results = await Promise.all([
      fs.readFile(path.join(bundledPath, 'template.hbs'), 'utf-8'),
      fs.readFile(path.join(bundledPath, 'header.hbs'), 'utf-8'),
      fs.readFile(path.join(bundledPath, 'commit.hbs'), 'utf-8'),
      fs.readFile(path.join(bundledPath, 'footer.hbs'), 'utf-8').catch(() => ''),
    ]);
    [template, header, commit, footer] = results;
  } catch {
    // Bundled templates don't exist, try development path
    const results = await Promise.all([
      fs.readFile(path.join(devPath, 'template.hbs'), 'utf-8'),
      fs.readFile(path.join(devPath, 'header.hbs'), 'utf-8'),
      fs.readFile(path.join(devPath, 'commit.hbs'), 'utf-8'),
      fs.readFile(path.join(devPath, 'footer.hbs'), 'utf-8').catch(() => ''),
    ]);
    [template, header, commit, footer] = results;
  }
  return { template, header, commit, footer: footer || undefined };
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
   * Converts GitCommit array to a stream format expected by conventional-commits-parser
   *
   * The parser expects commits in this format (matching git log output):
   * ```
   * <commit message>
   *
   * -hash-
   * <sha>
   * -----------------------
   *
   * ```
   * Each commit must END with the separator line.
   *
   * @param commits - Array of git commits
   * @returns Readable stream of formatted commit strings
   */
  protected commitsToParseStream(commits: ReadonlyArray<GitCommit>): Readable {
    // Each commit must be emitted as a separate chunk for the parser to recognize boundaries
    const chunks = commits.map((c) => `${c.message}\n\n-hash-\n${c.sha}\n-----------------------\n`);

    return Readable.from(chunks);
  }

  /**
   * TODO: add comment
   * @param commits
   * @param parserOpts
   * @returns
   */
  protected async parseGitCommits(
    commits: ReadonlyArray<GitCommit>,
    parserOpts: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<ReadonlyArray<ParsedCommit>> {
    const { parseCommitsStream } = await import('conventional-commits-parser');

    return new Promise((resolve, reject) => {
      const acc: ParsedCommit[] = [];
      this.commitsToParseStream(commits)
        .pipe(parseCommitsStream(parserOpts))
        .on('data', (commit: ParsedCommit) => {
          acc.push(commit);
        })
        .on('end', () => resolve(acc))
        .on('error', (err: unknown) => reject(err));
    });
  }

  /**
   * TODO: add comment
   */
  protected commitsToWriteStream(commits: ReadonlyArray<ParsedCommit>): Readable {
    const queue = [...commits];
    return new Readable({
      objectMode: true,
      read() {
        if (queue.length === 0) {
          this.push(null);
          return;
        }
        this.push(queue.shift());
      },
    });
  }

  /**
   * Converts parsed commits to changelog markdown using conventional-changelog-writer
   *
   * @param commits - Array of parsed commits from conventional-commits-parser
   * @param writerOpts - Writer options from the preset (includes templates, transform functions, etc.)
   * @param context - Context object with version, date, repository info for link generation
   * @returns Array of markdown chunks representing the changelog
   */
  protected async parsedCommitsToChangelog(
    commits: ReadonlyArray<ParsedCommit>,
    writerOpts: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    context: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<ReadonlyArray<string>> {
    const { writeChangelogStream } = await import('conventional-changelog-writer');

    return new Promise((resolve, reject) => {
      const chunks: string[] = [];
      this.commitsToWriteStream(commits)
        .pipe(writeChangelogStream(context, writerOpts))
        .on('data', (buf: Buffer | string) => {
          // writer() may emit Buffer or string
          chunks.push(typeof buf === 'string' ? buf : buf.toString('utf8'));
        })
        .on('end', () => resolve(chunks))
        .on('error', (err: unknown) => reject(err));
    });
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
    const { commits = [], preset = 'conventionalcommits', workspace, repository } = options;

    try {
      // Get the preset factory from our static map (so Rollup can bundle everything)
      const createPreset = PRESET_MAP[preset];
      if (!createPreset) {
        throw new Error(`Unknown preset: ${preset}`);
      }
      const presetConfig = await createPreset();

      // The preset returns { parser, writer, commits } - not parserOpts/writerOpts!
      const parserOpts = presetConfig.parser || {};
      const writerOpts = presetConfig.writer || {};

      // Always load templates as strings to ensure they work in both dev and bundled modes
      // In dev mode, templates are in node_modules; in bundled mode, they're in dist/templates
      this.log.debug({ preset }, 'Loading templates as strings');
      const templates = await loadTemplates(preset);
      writerOpts.mainTemplate = templates.template;
      writerOpts.headerPartial = templates.header;
      writerOpts.commitPartial = templates.commit;
      if (templates.footer) {
        writerOpts.footerPartial = templates.footer;
      }

      // Parse the commits using conventional-commits-parser
      const parsedCommits = await this.parseGitCommits(commits, parserOpts);

      // Build context for the writer (needed for link generation)
      const date = new Date().toISOString().split('T')[0];
      const context = {
        version: workspace.newVersion,
        date,
        host: 'https://github.com',
        owner: repository.owner,
        repository: repository.repo,
        linkReferences: true,
        commitUrlFormat: `https://github.com/${repository.owner}/${repository.repo}/commit/{{hash}}`,
        compareUrlFormat: `https://github.com/${repository.owner}/${repository.repo}/compare/{{previousTag}}...{{currentTag}}`,
        issueUrlFormat: `https://github.com/${repository.owner}/${repository.repo}/issues/{{id}}`,
        userUrlFormat: 'https://github.com/{{user}}',
      };

      // Convert parsed commits to changelog markdown
      const changelogChunks = await this.parsedCommitsToChangelog(parsedCommits, writerOpts, context);
      const newContent = changelogChunks.join('');

      this.log.debug({ contentLength: newContent.length }, 'Changelog content generated');

      // Check if changelog exists
      const changelogExists = await this.fileExists(options.changelogPath);
      this.log.debug({ changelogPath: options.changelogPath, exists: changelogExists }, 'Checked changelog existence');

      // Read existing changelog
      const existingChangelog = changelogExists ? await fs.readFile(options.changelogPath, 'utf-8') : '';
      if (changelogExists) {
        this.log.debug(
          { changelogPath: options.changelogPath, existingLength: existingChangelog.length },
          'Read existing changelog',
        );
      }

      // Merge new content with existing changelog
      let finalContent = this.mergeChangelogs(newContent, existingChangelog);

      // Append child workspace summary for root workspace
      if (options.childWorkspaces && options.childWorkspaces.length > 0) {
        const childSummary = this.generateChildWorkspaceSummary(options.childWorkspaces);
        finalContent = this.appendChildSummary(finalContent, childSummary, workspace.newVersion);
        this.log.debug({ childCount: options.childWorkspaces.length }, 'Appended child workspace summary');
      }

      // Write changelog to file
      await this.writeChangelog(options.changelogPath, finalContent);

      this.log.info(
        {
          workspace: workspace.path,
          changelogPath: options.changelogPath,
          created: !changelogExists,
          contentLength: finalContent.length,
        },
        'Changelog generated successfully',
      );

      return {
        content: finalContent,
        path: options.changelogPath,
        created: !changelogExists,
      };
    } catch (error) {
      const { FileOperationError } = await import('../utils/errors.js');
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error(
        {
          workspace: workspace.path,
          changelogPath: options.changelogPath,
          error,
          errorMessage,
        },
        'Failed to generate changelog',
      );
      throw new FileOperationError(
        options.changelogPath,
        'generate',
        `Failed to generate changelog for ${workspace.path}: ${errorMessage}`,
        error,
      );
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
