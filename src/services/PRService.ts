/**
 * Pull Request Service
 *
 * Service for creating and managing GitHub pull requests.
 * Provides methods for PR lifecycle management including creation,
 * merging, status checking, and existence validation.
 *
 * Usage:
 * ```typescript
 * const prService = new PRService(githubService);
 *
 * const createResult = await prService.create({
 *   title: 'Version Update 1.0.0',
 *   body: 'Update workspace versions',
 *   base: 'main',
 *   head: 'version_bump_v1.0.0',
 * });
 * ```
 */

import type { GitHubService } from './GitHubService.js';
import { GitHubAPIError } from '../utils/errors.js';
import { ok, err, type Result } from '../types/result.js';
import { logger } from '../utils/logger.js';
import type { WorkspaceTree, WorkspaceNode } from '../types/workspace.js';

/**
 * Parameters for creating a pull request
 */
export interface CreatePRParams {
  /**
   * PR title
   */
  readonly title: string;

  /**
   * PR body (markdown formatted)
   */
  readonly body: string;

  /**
   * Base branch (target branch for PR)
   */
  readonly base: string;

  /**
   * Head branch (source branch with changes)
   */
  readonly head: string;

  /**
   * Draft PR flag (optional)
   */
  readonly draft?: boolean;
}

/**
 * Parameters for merging a pull request
 */
export interface MergePRParams {
  /**
   * Pull request number
   */
  readonly prNumber: number;

  /**
   * Merge method (merge, squash, or rebase)
   */
  readonly mergeMethod?: 'merge' | 'squash' | 'rebase';

  /**
   * Commit title for merge (optional)
   */
  readonly commitTitle?: string;

  /**
   * Commit message for merge (optional)
   */
  readonly commitMessage?: string;
}

/**
 * Parameters for checking PR merge status
 */
export interface HasMergedParams {
  /**
   * Pull request number
   */
  readonly prNumber: number;

  /**
   * Timeout in milliseconds (default: 60000)
   */
  readonly timeout?: number;

  /**
   * Polling interval in milliseconds (default: 5000)
   */
  readonly interval?: number;
}

/**
 * Parameters for checking PR existence
 */
export interface ExistsPRParams {
  /**
   * Base branch
   */
  readonly base: string;

  /**
   * Head branch
   */
  readonly head: string;
}

/**
 * Pull request creation response
 */
export interface PRCreateResponse {
  /**
   * Pull request number
   */
  readonly number: number;

  /**
   * Pull request HTML URL
   */
  readonly htmlUrl: string;

  /**
   * PR state (open, closed, merged)
   */
  readonly state: string;
}

/**
 * Pull request merge response
 */
export interface PRMergeResponse {
  /**
   * Whether the merge was successful
   */
  readonly merged: boolean;

  /**
   * Merge commit SHA
   */
  readonly sha: string;

  /**
   * Merge message
   */
  readonly message: string;
}

/**
 * Pull request existence response
 */
export interface PRExistsResponse {
  /**
   * Whether a PR exists
   */
  readonly exists: boolean;

  /**
   * PR number if exists
   */
  readonly number?: number;

  /**
   * PR state if exists
   */
  readonly state?: string;
}

/**
 * Pull Request Service
 *
 * Manages GitHub pull request operations with:
 * - PR creation with formatted body
 * - PR merging with auto-merge support
 * - Merge status polling
 * - PR existence checking
 */
export class PRService {
  private readonly github: GitHubService;

  /**
   * Create a new PR service instance
   *
   * @param github - GitHub service instance
   *
   * @example
   * ```typescript
   * const prService = new PRService(githubService);
   * ```
   */
  constructor(github: GitHubService) {
    this.github = github;

    logger.info('PRService initialized');
  }

  /**
   * Create a new pull request
   *
   * @param params - PR creation parameters
   * @returns Result containing PR response or error
   *
   * @example
   * ```typescript
   * const result = await prService.create({
   *   title: 'Version Update 1.0.0',
   *   body: buildPRBody(workspaceTree),
   *   base: 'main',
   *   head: 'version_bump_v1.0.0',
   * });
   * ```
   */
  async create(params: CreatePRParams): Promise<Result<PRCreateResponse, GitHubAPIError>> {
    try {
      const { owner, repo } = this.github.getRepository();

      logger.info(
        {
          title: params.title,
          base: params.base,
          head: params.head,
          draft: params.draft,
        },
        'Creating pull request',
      );

      const response = await this.github.executeWithRetry('createPR', (octokit) =>
        octokit.rest.pulls.create({
          owner,
          repo,
          title: params.title,
          body: params.body,
          base: params.base,
          head: params.head,
          draft: params.draft ?? false,
        }),
      );

      const result: PRCreateResponse = {
        number: response.data.number,
        htmlUrl: response.data.html_url,
        state: response.data.state,
      };

      logger.info(
        {
          prNumber: result.number,
          htmlUrl: result.htmlUrl,
          state: result.state,
        },
        'Pull request created successfully',
      );

      return ok(result);
    } catch (error) {
      const apiError =
        error instanceof GitHubAPIError
          ? error
          : new GitHubAPIError('createPR', 'Failed to create pull request', undefined, error);

      logger.error(
        {
          operation: 'createPR',
          title: params.title,
          error: apiError.message,
        },
        'Failed to create pull request',
      );

      return err(apiError);
    }
  }

  /**
   * Merge a pull request
   *
   * @param params - PR merge parameters
   * @returns Result containing merge response or error
   *
   * @example
   * ```typescript
   * const result = await prService.merge({
   *   prNumber: 123,
   *   mergeMethod: 'squash',
   * });
   * ```
   */
  async merge(params: MergePRParams): Promise<Result<PRMergeResponse, GitHubAPIError>> {
    try {
      const { owner, repo } = this.github.getRepository();

      logger.info(
        {
          prNumber: params.prNumber,
          mergeMethod: params.mergeMethod ?? 'merge',
        },
        'Merging pull request',
      );

      const response = await this.github.executeWithRetry('mergePR', (octokit) =>
        octokit.rest.pulls.merge({
          owner,
          repo,
          pull_number: params.prNumber,
          merge_method: params.mergeMethod ?? 'merge',
          commit_title: params.commitTitle,
          commit_message: params.commitMessage,
        }),
      );

      const result: PRMergeResponse = {
        merged: response.data.merged,
        sha: response.data.sha,
        message: response.data.message,
      };

      logger.info(
        {
          prNumber: params.prNumber,
          merged: result.merged,
          sha: result.sha,
        },
        'Pull request merged successfully',
      );

      return ok(result);
    } catch (error) {
      const apiError =
        error instanceof GitHubAPIError
          ? error
          : new GitHubAPIError('mergePR', 'Failed to merge pull request', undefined, error);

      logger.error(
        {
          operation: 'mergePR',
          prNumber: params.prNumber,
          error: apiError.message,
        },
        'Failed to merge pull request',
      );

      return err(apiError);
    }
  }

  /**
   * Check if a pull request has been merged (with polling)
   *
   * Polls the PR status until it's merged or timeout is reached.
   *
   * @param params - Merge check parameters with timeout and interval
   * @returns Result containing boolean or error
   *
   * @example
   * ```typescript
   * const result = await prService.hasMerged({
   *   prNumber: 123,
   *   timeout: 60000,  // 60 seconds
   *   interval: 5000,  // poll every 5 seconds
   * });
   * ```
   */
  async hasMerged(params: HasMergedParams): Promise<Result<boolean, GitHubAPIError>> {
    const timeout = params.timeout ?? 60000; // Default 60 seconds
    const interval = params.interval ?? 5000; // Default 5 seconds
    const startTime = Date.now();

    try {
      const { owner, repo } = this.github.getRepository();

      logger.info(
        {
          prNumber: params.prNumber,
          timeout,
          interval,
        },
        'Checking if pull request has been merged',
      );

      while (Date.now() - startTime < timeout) {
        const response = await this.github.executeWithRetry('getPR', (octokit) =>
          octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: params.prNumber,
          }),
        );

        if (response.data.merged) {
          logger.info(
            {
              prNumber: params.prNumber,
              mergedAt: response.data.merged_at,
            },
            'Pull request has been merged',
          );
          return ok(true);
        }

        if (response.data.state === 'closed' && !response.data.merged) {
          logger.info(
            {
              prNumber: params.prNumber,
              state: response.data.state,
            },
            'Pull request is closed but not merged',
          );
          return ok(false);
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, interval));
      }

      // Timeout reached
      logger.warn(
        {
          prNumber: params.prNumber,
          timeout,
          elapsed: Date.now() - startTime,
        },
        'Timeout reached while waiting for PR to merge',
      );

      return ok(false);
    } catch (error) {
      const apiError =
        error instanceof GitHubAPIError
          ? error
          : new GitHubAPIError('hasMerged', 'Failed to check PR merge status', undefined, error);

      logger.error(
        {
          operation: 'hasMerged',
          prNumber: params.prNumber,
          error: apiError.message,
        },
        'Failed to check if PR has been merged',
      );

      return err(apiError);
    }
  }

  /**
   * Check if a pull request exists for given base and head branches
   *
   * @param params - PR existence check parameters
   * @returns Result containing existence response or error
   *
   * @example
   * ```typescript
   * const result = await prService.exists({
   *   base: 'main',
   *   head: 'version_bump_v1.0.0',
   * });
   *
   * if (result.ok && result.value.exists) {
   *   console.log('PR exists:', result.value.number);
   * }
   * ```
   */
  async exists(params: ExistsPRParams): Promise<Result<PRExistsResponse, GitHubAPIError>> {
    try {
      const { owner, repo } = this.github.getRepository();

      logger.info(
        {
          base: params.base,
          head: params.head,
        },
        'Checking if pull request exists',
      );

      const response = await this.github.executeWithRetry('listPRs', (octokit) =>
        octokit.rest.pulls.list({
          owner,
          repo,
          state: 'open',
          base: params.base,
          head: `${owner}:${params.head}`,
        }),
      );

      if (response.data.length > 0) {
        const pr = response.data[0];
        const result: PRExistsResponse = {
          exists: true,
          number: pr.number,
          state: pr.state,
        };

        logger.info(
          {
            prNumber: result.number,
            state: result.state,
          },
          'Pull request exists',
        );

        return ok(result);
      }

      logger.info(
        {
          base: params.base,
          head: params.head,
        },
        'No pull request found',
      );

      return ok({ exists: false });
    } catch (error) {
      const apiError =
        error instanceof GitHubAPIError
          ? error
          : new GitHubAPIError('existsPR', 'Failed to check if PR exists', undefined, error);

      logger.error(
        {
          operation: 'existsPR',
          base: params.base,
          head: params.head,
          error: apiError.message,
        },
        'Failed to check if PR exists',
      );

      return err(apiError);
    }
  }

  /**
   * Build PR body from workspace tree
   *
   * Formats workspace tree into markdown PR body with:
   * - Version summary
   * - Workspace hierarchy
   * - Changed files indicators
   *
   * @param tree - Workspace tree with versions
   * @returns Formatted PR body in markdown
   *
   * @example
   * ```typescript
   * const body = PRService.buildPRBody(workspaceTree);
   * ```
   */
  static buildPRBody(tree: WorkspaceTree): string {
    const sections: string[] = [
      `# Version Update: ${tree.root.workspace.name} ${tree.masterVersion}`,
      '',
      '## 📦 Workspace Versions',
      '',
    ];

    // Root workspace
    sections.push(`### 🏠 Root: ${tree.root.workspace.name}`);
    sections.push(`**Version**: \`${tree.root.workspace.version}\`  `);
    sections.push(`**Path**: \`${tree.root.workspace.path}\`  `);
    sections.push(`**Type**: \`${tree.root.workspace.type}\`  `);
    sections.push('');

    // Child workspaces (if any)
    if (tree.root.children.length > 0) {
      sections.push('### 📁 Child Workspaces');
      sections.push('');

      for (const child of tree.root.children) {
        sections.push(...PRService.formatWorkspaceNode(child, 0));
      }
    }

    return sections.join('\n');
  }

  /**
   * Format a workspace node with indentation
   *
   * @param node - Workspace node to format
   * @param indentLevel - Indentation level (0-based)
   * @returns Array of formatted lines
   */
  private static formatWorkspaceNode(node: WorkspaceNode, indentLevel: number): string[] {
    const indent = '  '.repeat(indentLevel);
    const changeIndicator = node.workspace.hasChanges ? '🔄' : '✓';

    const lines = [
      `${indent}- ${changeIndicator} **${node.workspace.name}** \`${node.workspace.version}\``,
      `${indent}  - Path: \`${node.workspace.path}\``,
      `${indent}  - Type: \`${node.workspace.type}\``,
    ];

    // Recursively add children
    if (node.children.length > 0) {
      for (const child of node.children) {
        lines.push(...PRService.formatWorkspaceNode(child, indentLevel + 1));
      }
    }

    return lines;
  }
}
