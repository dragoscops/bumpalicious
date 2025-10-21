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
import { Loggable } from '../Loggable.js';
import { ok, err, type Result } from '../types/result.js';
import type { WorkspaceTree, WorkspaceNode } from '../types/workspace.js';
import { GitHubAPIError } from '../utils/errors.js';

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
 * Parameters for waiting for PR checks
 */
export interface WaitForChecksParams {
  /**
   * Pull request number
   */
  readonly prNumber: number;

  /**
   * Timeout in milliseconds (default: 300000 = 5 minutes)
   */
  readonly timeout?: number;

  /**
   * Polling interval in milliseconds (default: 10000 = 10 seconds)
   */
  readonly interval?: number;
}

/**
 * PR checks status result
 */
export interface ChecksStatusResult {
  /**
   * Whether all checks passed
   */
  readonly allPassed: boolean;

  /**
   * Whether checks are still pending
   */
  readonly pending: boolean;

  /**
   * Total number of checks
   */
  readonly totalChecks: number;

  /**
   * Number of passed checks
   */
  readonly passedChecks: number;

  /**
   * Number of failed checks
   */
  readonly failedChecks: number;

  /**
   * Mergeable state from GitHub
   */
  readonly mergeableState: string;

  /**
   * Failed check details
   */
  readonly failedCheckNames?: string[];
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
export class PRService extends Loggable {
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
    super();
    this.github = github;

    this.log.info(
      {
        ...github.getRepository(),
      },
      'PRService initialized',
    );
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
    this.log.debug(
      {
        title: params.title,
        base: params.base,
        head: params.head,
        draft: params.draft ?? false,
        bodyLength: params.body.length,
      },
      'Creating pull request',
    );

    try {
      const { owner, repo } = this.github.getRepository();

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

      this.log.info(
        {
          prNumber: result.number,
          htmlUrl: result.htmlUrl,
          state: result.state,
          title: params.title,
        },
        'Pull request created successfully',
      );

      return ok(result);
    } catch (error) {
      const apiError =
        error instanceof GitHubAPIError
          ? error
          : new GitHubAPIError('createPR', 'Failed to create pull request', undefined, error);

      this.log.error(
        {
          operation: 'createPR',
          title: params.title,
          base: params.base,
          head: params.head,
          error: apiError.message,
          statusCode: apiError.statusCode,
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
    this.log.debug(
      {
        prNumber: params.prNumber,
        mergeMethod: params.mergeMethod ?? 'merge',
        hasCommitTitle: !!params.commitTitle,
        hasCommitMessage: !!params.commitMessage,
      },
      'Merging pull request',
    );

    try {
      const { owner, repo } = this.github.getRepository();

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

      this.log.info(
        {
          prNumber: params.prNumber,
          merged: result.merged,
          sha: result.sha,
          mergeMethod: params.mergeMethod ?? 'merge',
        },
        'Pull request merged successfully',
      );

      return ok(result);
    } catch (error) {
      const apiError =
        error instanceof GitHubAPIError
          ? error
          : new GitHubAPIError('mergePR', 'Failed to merge pull request', undefined, error);

      this.log.error(
        {
          operation: 'mergePR',
          prNumber: params.prNumber,
          mergeMethod: params.mergeMethod ?? 'merge',
          error: apiError.message,
          statusCode: apiError.statusCode,
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

    this.log.debug(
      {
        prNumber: params.prNumber,
        timeout,
        interval,
      },
      'Starting merge status polling',
    );

    try {
      const { owner, repo } = this.github.getRepository();

      while (Date.now() - startTime < timeout) {
        const response = await this.github.executeWithRetry('getPR', (octokit) =>
          octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: params.prNumber,
          }),
        );

        if (response.data.merged) {
          this.log.info(
            {
              prNumber: params.prNumber,
              mergedAt: response.data.merged_at,
            },
            'Pull request has been merged',
          );
          return ok(true);
        }

        if (response.data.state === 'closed' && !response.data.merged) {
          this.log.info(
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
      this.log.warn(
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
          : new GitHubAPIError('hasMerged', 'Failed to check if pull request is merged', undefined, error);

      this.log.error(
        {
          operation: 'hasMerged',
          prNumber: params.prNumber,
          elapsedMs: Date.now() - startTime,
          error: apiError.message,
          statusCode: apiError.statusCode,
        },
        'Failed to check PR merge status',
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
    this.log.debug(
      {
        base: params.base,
        head: params.head,
      },
      'Checking if pull request exists',
    );

    try {
      const { owner, repo } = this.github.getRepository();

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

        this.log.info(
          {
            prNumber: result.number,
            state: result.state,
          },
          'Pull request exists',
        );

        return ok(result);
      }

      this.log.info(
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
          : new GitHubAPIError('existsPR', 'Failed to check if pull request exists', undefined, error);

      this.log.error(
        {
          operation: 'existsPR',
          base: params.base,
          head: params.head,
          error: apiError.message,
          statusCode: apiError.statusCode,
        },
        'Failed to check PR existence',
      );

      return err(apiError);
    }
  }

  /**
   * Wait for PR checks to complete and verify they pass
   *
   * Polls the PR status until all checks complete or timeout is reached.
   * Checks both status checks (legacy) and check runs (modern GitHub checks).
   *
   * @param params - Check waiting parameters
   * @returns Result containing checks status or error
   *
   * @example
   * ```typescript
   * const result = await prService.waitForChecks({
   *   prNumber: 123,
   *   timeout: 300000,  // 5 minutes
   *   interval: 10000,  // 10 seconds
   * });
   *
   * if (result.ok && result.value.allPassed) {
   *   // Checks passed, safe to merge
   * }
   * ```
   */
  async waitForChecks(params: WaitForChecksParams): Promise<Result<ChecksStatusResult, GitHubAPIError>> {
    const timeout = params.timeout ?? 300000; // 5 minutes default
    const interval = params.interval ?? 10000; // 10 seconds default
    const startTime = Date.now();

    this.log.debug(
      {
        prNumber: params.prNumber,
        timeout,
        interval,
      },
      'Waiting for PR checks to complete',
    );

    try {
      const { owner, repo } = this.github.getRepository();

      while (Date.now() - startTime < timeout) {
        // Get PR details to check mergeable state and head SHA
        const prResponse = await this.github.executeWithRetry('getPR', (octokit) =>
          octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: params.prNumber,
          }),
        );

        const pr = prResponse.data;
        const headSha = pr.head.sha;
        const mergeableState = pr.mergeable_state || 'unknown';

        this.log.debug(
          {
            prNumber: params.prNumber,
            mergeableState,
            mergeable: pr.mergeable,
            headSha,
          },
          'PR status checked',
        );

        // Get combined status (legacy status checks)
        const statusResponse = await this.github.executeWithRetry('getCombinedStatus', (octokit) =>
          octokit.rest.repos.getCombinedStatusForRef({
            owner,
            repo,
            ref: headSha,
          }),
        );

        const combinedStatus = statusResponse.data;

        // Get check runs (modern GitHub checks)
        const checkRunsResponse = await this.github.executeWithRetry('listCheckRuns', (octokit) =>
          octokit.rest.checks.listForRef({
            owner,
            repo,
            ref: headSha,
          }),
        );

        const checkRuns = checkRunsResponse.data.check_runs;

        // Count totals
        const statusChecks = combinedStatus.statuses;
        const totalStatusChecks = statusChecks.length;
        const totalCheckRuns = checkRuns.length;
        const totalChecks = totalStatusChecks + totalCheckRuns;

        // Count completed and passed
        const passedStatusChecks = statusChecks.filter((s) => s.state === 'success').length;
        const failedStatusChecks = statusChecks.filter((s) => s.state === 'failure' || s.state === 'error').length;
        const pendingStatusChecks = statusChecks.filter((s) => s.state === 'pending').length;

        const passedCheckRuns = checkRuns.filter((c) => c.conclusion === 'success').length;
        const failedCheckRuns = checkRuns.filter(
          (c) => c.conclusion === 'failure' || c.conclusion === 'cancelled' || c.conclusion === 'timed_out',
        ).length;
        const pendingCheckRuns = checkRuns.filter((c) => c.status !== 'completed').length;

        const passedChecks = passedStatusChecks + passedCheckRuns;
        const failedChecks = failedStatusChecks + failedCheckRuns;
        const pendingChecks = pendingStatusChecks + pendingCheckRuns;

        // Collect failed check names for debugging
        const failedCheckNames = [
          ...statusChecks.filter((s) => s.state === 'failure' || s.state === 'error').map((s) => s.context),
          ...checkRuns
            .filter((c) => c.conclusion === 'failure' || c.conclusion === 'cancelled' || c.conclusion === 'timed_out')
            .map((c) => c.name),
        ];

        this.log.debug(
          {
            prNumber: params.prNumber,
            totalChecks,
            passedChecks,
            failedChecks,
            pendingChecks,
            mergeableState,
            combinedState: combinedStatus.state,
          },
          'Checks status',
        );

        // If there are no checks at all, consider it ready
        const noChecks = totalChecks === 0;

        // Check if all checks are complete and passed
        const allComplete = pendingChecks === 0 && totalChecks > 0;
        const allPassed = allComplete && failedChecks === 0;

        // Check if we should return (success or failure)
        if (failedChecks > 0) {
          // Checks failed - return immediately
          const result: ChecksStatusResult = {
            allPassed: false,
            pending: false,
            totalChecks,
            passedChecks,
            failedChecks,
            mergeableState,
            failedCheckNames,
          };

          this.log.warn(
            {
              prNumber: params.prNumber,
              failedChecks,
              failedCheckNames,
            },
            'PR checks failed',
          );

          return ok(result);
        }

        if (allPassed || noChecks) {
          // All checks passed or no checks required
          const result: ChecksStatusResult = {
            allPassed: true,
            pending: false,
            totalChecks,
            passedChecks,
            failedChecks: 0,
            mergeableState,
          };

          this.log.info(
            {
              prNumber: params.prNumber,
              totalChecks,
              passedChecks,
              noChecks,
            },
            'All PR checks passed',
          );

          return ok(result);
        }

        // Checks still pending - wait and retry
        this.log.debug(
          {
            prNumber: params.prNumber,
            pendingChecks,
            waitingMs: interval,
          },
          'Checks still pending, waiting...',
        );

        await new Promise((resolve) => setTimeout(resolve, interval));
      }

      // Timeout reached
      const apiError = new GitHubAPIError(
        'waitForChecks',
        `Timeout waiting for PR checks to complete after ${timeout}ms`,
        undefined,
      );

      this.log.error(
        {
          operation: 'waitForChecks',
          prNumber: params.prNumber,
          timeout,
        },
        'Timeout waiting for PR checks',
      );

      return err(apiError);
    } catch (error) {
      const apiError =
        error instanceof GitHubAPIError
          ? error
          : new GitHubAPIError('waitForChecks', 'Failed to check PR status', undefined, error);

      this.log.error(
        {
          operation: 'waitForChecks',
          prNumber: params.prNumber,
          error: apiError.message,
          statusCode: apiError.statusCode,
        },
        'Failed to wait for PR checks',
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
