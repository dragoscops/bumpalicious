/**
 * Changelog Service
 *
 * Generates CHANGELOG.md files from conventional commits
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { GitCommit, RepositoryInfo } from '../types/git.js';
import type { Version } from '../types/version.js';
import type { WorkspaceNode, WorkspaceWithVersion } from '../types/workspace.js';
import { Loggable } from '../utils/Loggable.js';

/** Supported changelog preset formats */
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

/** Parsed commit structure from conventional-commits-parser */
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

/** Options for changelog generation */
export interface GenerateChangelogOptions {
  readonly workspace: WorkspaceWithVersion;
  readonly changelogPath: string;
  readonly preset?: ChangelogPreset;
  readonly childWorkspaces?: ReadonlyArray<WorkspaceNode>;
  readonly repository: RepositoryInfo;
  readonly lastTag?: string | null;
  readonly commits?: ReadonlyArray<GitCommit>;
}

/** Result of changelog generation */
export interface ChangelogResult {
  readonly content: string;
  readonly path: string;
  readonly created: boolean;
}

/** Changelog generator for workspaces */
export class ChangelogService extends Loggable {
  constructor() {
    super();
    this.log.info('ChangelogService initialized');
  }

  // ====================
  // Public API
  // ====================

  /** Generate changelog for workspace */
  async generateForWorkspace(options: GenerateChangelogOptions): Promise<ChangelogResult> {
    try {
      const fileExisted = await this.fileExists(options.changelogPath);
      const existingContent = await this.readExisting(options.changelogPath);
      const newContent = await this.generateNew(options);
      const finalContent = this.buildFinal(newContent, existingContent, options);

      await this.write(options.changelogPath, finalContent);

      return this.createResult(options.changelogPath, finalContent, !fileExisted);
    } catch (error) {
      throw await this.handleError(error, options);
    }
  }

  // ====================
  // Content Generation
  // ====================

  /** Generate new changelog content from commits */
  private async generateNew(options: GenerateChangelogOptions): Promise<string> {
    const { commits = [], preset = 'conventionalcommits', workspace, repository } = options;

    const { parserOpts, writerOpts } = await this.loadPreset(preset);
    const parsedCommits = await this.parseCommits(commits, parserOpts);
    const context = this.buildContext(workspace, repository);
    const chunks = await this.writeChangelog(parsedCommits, writerOpts, context);

    return chunks.join('');
  }

  /** Load preset configuration */
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
  private async parseCommits(
    commits: ReadonlyArray<GitCommit>,
    parserOpts: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<ReadonlyArray<ParsedCommit>> {
    const { parseCommitsStream } = await import('conventional-commits-parser');
    const acc: ParsedCommit[] = [];

    return new Promise((resolve, reject) => {
      this.createCommitStream(commits)
        .pipe(parseCommitsStream(parserOpts))
        .on('data', (commit: ParsedCommit) => acc.push(commit))
        .on('end', () => resolve(acc))
        .on('error', reject);
    });
  }

  /** Create readable stream from commits */
  private createCommitStream(commits: ReadonlyArray<GitCommit>): Readable {
    const chunks = commits.map((c) => `${c.message}\n\n-hash-\n${c.sha}\n-----------------------\n`);
    return Readable.from(chunks);
  }

  /** Build context for changelog writer */
  private buildContext(workspace: WorkspaceWithVersion, repository: RepositoryInfo) {
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

  /** Convert parsed commits to markdown */
  private async writeChangelog(
    commits: ReadonlyArray<ParsedCommit>,
    writerOpts: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    context: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<ReadonlyArray<string>> {
    const { writeChangelogStream } = await import('conventional-changelog-writer');
    const chunks: string[] = [];

    return new Promise((resolve, reject) => {
      this.createParsedCommitStream(commits)
        .pipe(writeChangelogStream(context, writerOpts))
        .on('data', (buf: Buffer | string) => chunks.push(typeof buf === 'string' ? buf : buf.toString('utf8')))
        .on('end', () => resolve(chunks))
        .on('error', reject);
    });
  }

  /** Create object stream from parsed commits */
  private createParsedCommitStream(commits: ReadonlyArray<ParsedCommit>): Readable {
    const queue = [...commits];
    return new Readable({
      objectMode: true,
      read() {
        this.push(queue.length === 0 ? null : queue.shift());
      },
    });
  }

  // ====================
  // Content Assembly
  // ====================

  /** Build final changelog content */
  private buildFinal(newContent: string, existingContent: string, options: GenerateChangelogOptions): string {
    let content = this.merge(newContent, existingContent);

    if (options.childWorkspaces?.length) {
      const summary = this.buildChildSummary(options.childWorkspaces);
      content = this.insertChildSummary(content, summary, options.workspace.newVersion);
    }

    return content;
  }

  /** Merge new content with existing changelog */
  private merge(newContent: string, existingContent: string): string {
    if (!existingContent) return this.ensureHeader(newContent);

    const { header, body } = this.splitChangelog(existingContent);
    const newWithoutHeader = newContent.replace(/^#\s+.*?\n+/m, '').trim();

    return `${header}\n\n${newWithoutHeader}\n\n${body}`.trim() + '\n';
  }

  /** Split changelog into header and body */
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
  private ensureHeader(content: string): string {
    return content.match(/^# CHANGELOG/i) ? content : `# Changelog\n\n${content}`;
  }

  // ====================
  // Child Workspace Summary
  // ====================

  /** Build markdown summary of child workspaces */
  private buildChildSummary(childWorkspaces: ReadonlyArray<WorkspaceNode>): string {
    const workspaces = this.flattenWorkspaces(childWorkspaces).sort((a, b) => a.path.localeCompare(b.path));

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

  /** Recursively flatten workspace tree */
  private flattenWorkspaces(nodes: ReadonlyArray<WorkspaceNode>): WorkspaceWithVersion[] {
    const result: WorkspaceWithVersion[] = [];

    for (const node of nodes) {
      result.push(node.workspace);
      if (node.children.length) {
        result.push(...this.flattenWorkspaces(node.children));
      }
    }

    return result;
  }

  /** Insert child summary after version heading */
  private insertChildSummary(content: string, summary: string, version: Version): string {
    const regex = new RegExp(`^(#{1,3}\\s+\\[?${version.replace(/\./g, '\\.')}[^\\n]*\\n)`, 'm');
    const match = content.match(regex);

    if (!match) return `${summary}\n${content}`;

    const insertPos = match.index! + match[0].length;
    return content.slice(0, insertPos) + '\n' + summary + '\n' + content.slice(insertPos);
  }

  // ====================
  // File Operations
  // ====================

  /** Read existing changelog file */
  private async readExisting(changelogPath: string): Promise<string> {
    const exists = await this.fileExists(changelogPath);
    return exists ? await fs.readFile(changelogPath, 'utf-8') : '';
  }

  /** Write content to changelog file */
  private async write(changelogPath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(changelogPath), { recursive: true });
    await fs.writeFile(changelogPath, content, 'utf-8');
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

  // ====================
  // Result & Error Handling
  // ====================

  /** Create result object */
  private createResult(path: string, content: string, created: boolean): ChangelogResult {
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
}
