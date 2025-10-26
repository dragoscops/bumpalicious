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
import { GitCommit, RepositoryInfo } from '../types/git.js';
import type { Version } from '../types/version.js';
import type { WorkspaceNode, WorkspaceWithVersion } from '../types/workspace.js';
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
  readonly repository: RepositoryInfo;
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

  /** Generate changelog for workspace with commits */
  async generateForWorkspace(options: GenerateChangelogOptions): Promise<ChangelogResult> {
    try {
      const fileExisted = await this.fileExists(options.changelogPath);
      const existingContent = await this.readExistingChangelog(options.changelogPath);
      const newContent = await this.generateNewContent(options);
      const finalContent = await this.buildFinalContent(newContent, existingContent, options);

      await this.writeChangelog(options.changelogPath, finalContent);

      return this.buildResult(options.changelogPath, finalContent, !fileExisted);
    } catch (error) {
      throw await this.handleError(error, options);
    }
  }

  /** Generate new changelog content from commits */
  private async generateNewContent(options: GenerateChangelogOptions): Promise<string> {
    const { commits = [], preset = 'conventionalcommits', workspace, repository } = options;

    const { parserOpts, writerOpts } = await this.loadPreset(preset);
    const parsedCommits = await this.parseGitCommits(commits, parserOpts);
    const context = this.buildContext({ workspace, repository });
    const chunks = await this.parsedCommitsToChangelog(parsedCommits, writerOpts, context);

    return chunks.join('');
  }

  /** Load preset configuration dynamically */
  // TRICKY: Poorly defined typings on conventional-changelog presets makes it almost impossible to use proper types for parserOpts/writerOpts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async loadPreset(preset: ChangelogPreset): Promise<{ parserOpts: any; writerOpts: any }> {
    const presetModule = await import(`conventional-changelog-${preset}`);
    const config = await presetModule.default();
    return {
      parserOpts: config.parser || {},
      writerOpts: config.writer || {},
    };
  }

  /** Parse commits using conventional-commits-parser */
  private async parseGitCommits(
    commits: ReadonlyArray<GitCommit>,
    parserOpts: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<ReadonlyArray<ParsedCommit>> {
    const { parseCommitsStream } = await import('conventional-commits-parser');
    const acc: ParsedCommit[] = [];

    return new Promise((resolve, reject) => {
      this.commitsToParseStream(commits)
        .pipe(parseCommitsStream(parserOpts))
        .on('data', (commit: ParsedCommit) => acc.push(commit))
        .on('end', () => resolve(acc))
        .on('error', reject);
    });
  }

  /** Convert commits to stream format for parser */
  private commitsToParseStream(commits: ReadonlyArray<GitCommit>): Readable {
    const chunks = commits.map((c) => `${c.message}\n\n-hash-\n${c.sha}\n-----------------------\n`);
    return Readable.from(chunks);
  }

  /** Build context for changelog writer with GitHub links */
  private buildContext({ workspace, repository }: { workspace: WorkspaceWithVersion; repository: RepositoryInfo }) {
    const baseUrl = `https://github.com/${repository.owner}/${repository.repo}`;
    return {
      version: workspace.newVersion,
      date: new Date().toISOString().split('T')[0],
      host: 'https://github.com',
      owner: repository.owner,
      repository: repository.repo,
      linkReferences: true,
      commitUrlFormat: `${baseUrl}/commit/{{hash}}`,
      compareUrlFormat: `${baseUrl}/compare/{{previousTag}}...{{currentTag}}`,
      issueUrlFormat: `${baseUrl}/issues/{{id}}`,
      userUrlFormat: 'https://github.com/{{user}}',
    };
  }

  /** Convert parsed commits to markdown using writer */
  private async parsedCommitsToChangelog(
    commits: ReadonlyArray<ParsedCommit>,
    writerOpts: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    context: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<ReadonlyArray<string>> {
    const { writeChangelogStream } = await import('conventional-changelog-writer');
    const chunks: string[] = [];

    return new Promise((resolve, reject) => {
      this.commitsToWriteStream(commits)
        .pipe(writeChangelogStream(context, writerOpts))
        .on('data', (buf: Buffer | string) => chunks.push(typeof buf === 'string' ? buf : buf.toString('utf8')))
        .on('end', () => resolve(chunks))
        .on('error', reject);
    });
  }

  /** Convert parsed commits to stream for writer */
  private commitsToWriteStream(commits: ReadonlyArray<ParsedCommit>): Readable {
    const queue = [...commits];
    return new Readable({
      objectMode: true,
      read() {
        this.push(queue.length === 0 ? null : queue.shift());
      },
    });
  }

  /** Read existing changelog or return empty string */
  private async readExistingChangelog(changelogPath: string): Promise<string> {
    const exists = await this.fileExists(changelogPath);
    return exists ? await fs.readFile(changelogPath, 'utf-8') : '';
  }

  /** Build final changelog content with merging and child summary */
  private async buildFinalContent(
    newContent: string,
    existingContent: string,
    options: GenerateChangelogOptions,
  ): Promise<string> {
    let content = this.mergeChangelogs(newContent, existingContent);

    if (options.childWorkspaces?.length) {
      const summary = this.generateChildWorkspaceSummary(options.childWorkspaces);
      content = this.appendChildSummary(content, summary, options.workspace.newVersion);
    }

    return content;
  }

  /** Merge new content with existing changelog, preserving header */
  private mergeChangelogs(newContent: string, existingContent: string): string {
    if (!existingContent) return this.ensureChangelogHeader(newContent);

    const { header, body } = this.splitChangelog(existingContent);
    const newWithoutHeader = newContent.replace(/^#\s+.*?\n+/m, '').trim();

    return `${header}\n\n${newWithoutHeader}\n\n${body}`.trim() + '\n';
  }

  /** Split changelog into header and body sections */
  private splitChangelog(content: string): { header: string; body: string } {
    const versionRegex = /^#{1,3}\s+\[?\d+\.\d+\.\d+/m;
    const headerMatch = content.match(new RegExp(`^([\\s\\S]*?)(?=${versionRegex.source})`, 'm'));
    const bodyMatch = content.match(new RegExp(`(${versionRegex.source}[\\s\\S]*)`, 'm'));

    return {
      header: headerMatch?.[1].trim() || '# Changelog\n',
      body: bodyMatch?.[1] || content,
    };
  }

  /** Ensure changelog starts with header */
  private ensureChangelogHeader(content: string): string {
    return content.match(/^# CHANGELOG/i) ? content : `# Changelog\n\n${content}`;
  }

  /** Generate markdown summary of child workspaces */
  private generateChildWorkspaceSummary(childWorkspaces: ReadonlyArray<WorkspaceNode>): string {
    const workspaces = this.collectAllWorkspaces(childWorkspaces).sort((a, b) => a.path.localeCompare(b.path));

    const lines = [
      '### Child Workspaces',
      '',
      'The following workspaces are included in this release:',
      '',
      ...workspaces.map((w) => `- ${w.hasChanges ? '🔄' : '✓'} \`${w.path}\` - v${w.newVersion}`),
      '',
    ];

    return lines.join('\n');
  }

  /** Recursively collect all workspaces from tree */
  private collectAllWorkspaces(nodes: ReadonlyArray<WorkspaceNode>): WorkspaceWithVersion[] {
    const result: WorkspaceWithVersion[] = [];

    for (const node of nodes) {
      result.push(node.workspace);
      if (node.children.length) {
        result.push(...this.collectAllWorkspaces(node.children));
      }
    }

    return result;
  }

  /** Insert child summary after version heading */
  private appendChildSummary(content: string, summary: string, version: Version): string {
    const regex = new RegExp(`^(#{1,3}\\s+\\[?${version.replace(/\./g, '\\.')}[^\\n]*\\n)`, 'm');
    const match = content.match(regex);

    if (!match) return `${summary}\n${content}`;

    const insertPos = match.index! + match[0].length;
    return content.slice(0, insertPos) + '\n' + summary + '\n' + content.slice(insertPos);
  }

  /** Write content to changelog file, creating directory if needed */
  private async writeChangelog(changelogPath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(changelogPath), { recursive: true });
    await fs.writeFile(changelogPath, content, 'utf-8');
  }

  /** Build result object */
  private buildResult(path: string, content: string, created: boolean): ChangelogResult {
    this.log.info({ path, created, contentLength: content.length }, 'Changelog generated');
    return { content, path, created };
  }

  /** Handle and transform errors */
  private async handleError(error: unknown, options: GenerateChangelogOptions): Promise<never> {
    const { FileOperationError } = await import('../utils/errors.js');
    const message = error instanceof Error ? error.message : String(error);

    this.log.error({ workspace: options.workspace.path, error }, 'Changelog generation failed');

    throw new FileOperationError(
      options.changelogPath,
      'generate',
      `Failed to generate changelog for ${options.workspace.path}: ${message}`,
      error,
    );
  }

  /** Check if file exists */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
