/** Pull request service for GitHub PR operations */

import type { GitHubService } from './GitHubService.js';
import { ok, err, type Result } from '../types/result.js';
import type { WorkspaceTree, WorkspaceNode } from '../types/workspace.js';
import { GitHubAPIError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';

export interface CreatePRParams {
  readonly title: string;
  readonly body: string;
  readonly base: string;
  readonly head: string;
  readonly draft?: boolean;
}

export interface MergePRParams {
  readonly prNumber: number;
  readonly mergeMethod?: 'merge' | 'squash' | 'rebase';
  readonly commitTitle?: string;
  readonly commitMessage?: string;
}

export interface HasMergedParams {
  readonly prNumber: number;
  readonly timeout?: number;
  readonly interval?: number;
}

export interface ExistsPRParams {
  readonly base: string;
  readonly head: string;
}

export interface WaitForChecksParams {
  readonly prNumber: number;
  readonly timeout?: number;
  readonly interval?: number;
}

export interface ChecksStatusResult {
  readonly allPassed: boolean;
  readonly pending: boolean;
  readonly totalChecks: number;
  readonly passedChecks: number;
  readonly failedChecks: number;
  readonly mergeableState: string;
  readonly failedCheckNames?: string[];
}

export interface PRCreateResponse {
  readonly number: number;
  readonly htmlUrl: string;
  readonly state: string;
}

export interface PRMergeResponse {
  readonly merged: boolean;
  readonly sha: string;
  readonly message: string;
}

export interface PRExistsResponse {
  readonly exists: boolean;
  readonly number?: number;
  readonly state?: string;
}

/** Pull request service for creation, merging, and status checking */
export class PRService extends Loggable {
  private readonly github: GitHubService;

  constructor(github: GitHubService) {
    super();
    this.github = github;
    this.log.info({ ...github.getRepository() }, 'PRService initialized');
  }

  // ====================
  // Public API
  // ====================

  /** Create pull request */
  async create(params: CreatePRParams): Promise<Result<PRCreateResponse, GitHubAPIError>> {
    this.log.debug(
      {
        title: params.title,
        base: params.base,
        head: params.head,
        draft: params.draft ?? false,
        bodyLength: params.body.length,
      },
      'Creating PR',
    );

    try {
      const response = await this.createPR(params);
      const result = this.mapCreateResponse(response.data);

      this.log.info(
        { prNumber: result.number, htmlUrl: result.htmlUrl, state: result.state, title: params.title },
        'PR created',
      );
      return ok(result);
    } catch (error) {
      return this.handleError('createPR', 'Failed to create pull request', error, {
        title: params.title,
        base: params.base,
        head: params.head,
      });
    }
  }

  /** Merge pull request */
  async merge(params: MergePRParams): Promise<Result<PRMergeResponse, GitHubAPIError>> {
    this.log.debug(
      { prNumber: params.prNumber, mergeMethod: params.mergeMethod ?? 'merge', hasCommitTitle: !!params.commitTitle },
      'Merging PR',
    );

    try {
      const response = await this.mergePR(params);
      const result = this.mapMergeResponse(response.data);

      this.log.info(
        {
          prNumber: params.prNumber,
          merged: result.merged,
          sha: result.sha,
          mergeMethod: params.mergeMethod ?? 'merge',
        },
        'PR merged',
      );
      return ok(result);
    } catch (error) {
      return this.handleError('mergePR', 'Failed to merge pull request', error, {
        prNumber: params.prNumber,
        mergeMethod: params.mergeMethod ?? 'merge',
      });
    }
  }

  /** Get pull request details */
  async getPullRequest(
    prNumber: number,
  ): Promise<Result<{ headRef: string; baseRef: string; merged: boolean; state: string }, GitHubAPIError>> {
    this.log.debug({ prNumber }, 'Getting PR details');

    try {
      const response = await this.fetchPR(prNumber);
      const result = {
        headRef: response.data.head.ref,
        baseRef: response.data.base.ref,
        merged: response.data.merged,
        state: response.data.state,
      };

      this.log.info(
        { prNumber, headRef: result.headRef, merged: result.merged, state: result.state },
        'PR details retrieved',
      );
      return ok(result);
    } catch (error) {
      return this.handleError('getPullRequest', 'Failed to get pull request details', error, { prNumber });
    }
  }

  /** Check if PR has merged (with polling) */
  async hasMerged(params: HasMergedParams): Promise<Result<boolean, GitHubAPIError>> {
    const timeout = params.timeout ?? 60000;
    const interval = params.interval ?? 5000;
    const startTime = Date.now();

    this.log.debug({ prNumber: params.prNumber, timeout, interval }, 'Polling for merge status');

    try {
      return await this.pollUntilMerged(params.prNumber, timeout, interval, startTime);
    } catch (error) {
      return this.handleError('hasMerged', 'Failed to check if pull request is merged', error, {
        prNumber: params.prNumber,
        elapsedMs: Date.now() - startTime,
      });
    }
  }

  /** Check if PR exists */
  async exists(params: ExistsPRParams): Promise<Result<PRExistsResponse, GitHubAPIError>> {
    this.log.debug({ base: params.base, head: params.head }, 'Checking PR existence');

    try {
      const response = await this.listPRs(params);

      if (response.data.length > 0) {
        const pr = response.data[0];
        this.log.info({ prNumber: pr.number, state: pr.state }, 'PR exists');
        return ok({ exists: true, number: pr.number, state: pr.state });
      }

      this.log.info({ base: params.base, head: params.head }, 'No PR found');
      return ok({ exists: false });
    } catch (error) {
      return this.handleError('existsPR', 'Failed to check if pull request exists', error, {
        base: params.base,
        head: params.head,
      });
    }
  }

  /** Wait for PR checks to complete */
  async waitForChecks(params: WaitForChecksParams): Promise<Result<ChecksStatusResult, GitHubAPIError>> {
    const timeout = params.timeout ?? 300000;
    const interval = params.interval ?? 10000;
    const startTime = Date.now();

    this.log.debug({ prNumber: params.prNumber, timeout, interval }, 'Waiting for checks');

    try {
      return await this.pollUntilChecksComplete(params.prNumber, timeout, interval, startTime);
    } catch (error) {
      return this.handleError('waitForChecks', 'Failed to check PR status', error, { prNumber: params.prNumber });
    }
  }

  // ====================
  // Polling Operations
  // ====================

  /** Poll until PR is merged or timeout */
  private async pollUntilMerged(
    prNumber: number,
    timeout: number,
    interval: number,
    startTime: number,
  ): Promise<Result<boolean, GitHubAPIError>> {
    while (Date.now() - startTime < timeout) {
      const response = await this.fetchPR(prNumber);

      if (response.data.merged) {
        this.log.info({ prNumber, mergedAt: response.data.merged_at }, 'PR merged');
        return ok(true);
      }

      if (response.data.state === 'closed' && !response.data.merged) {
        this.log.info({ prNumber, state: response.data.state }, 'PR closed but not merged');
        return ok(false);
      }

      await this.wait(interval);
    }

    this.log.warn({ prNumber, timeout, elapsed: Date.now() - startTime }, 'Timeout waiting for merge');
    return ok(false);
  }

  /** Poll until checks complete or timeout */
  private async pollUntilChecksComplete(
    prNumber: number,
    timeout: number,
    interval: number,
    startTime: number,
  ): Promise<Result<ChecksStatusResult, GitHubAPIError>> {
    while (Date.now() - startTime < timeout) {
      const pr = await this.fetchPR(prNumber);
      const headSha = pr.data.head.sha;
      const mergeableState = pr.data.mergeable_state || 'unknown';

      this.log.debug({ prNumber, mergeableState, mergeable: pr.data.mergeable, headSha }, 'PR status checked');

      const checksStatus = await this.getChecksStatus(headSha, mergeableState);

      if (checksStatus.failedChecks > 0) {
        this.log.warn(
          { prNumber, failedChecks: checksStatus.failedChecks, failedCheckNames: checksStatus.failedCheckNames },
          'Checks failed',
        );
        return ok(checksStatus);
      }

      if (checksStatus.allPassed || checksStatus.totalChecks === 0) {
        this.log.info(
          { prNumber, totalChecks: checksStatus.totalChecks, passedChecks: checksStatus.passedChecks },
          'All checks passed',
        );
        return ok(checksStatus);
      }

      this.log.debug(
        { prNumber, pendingChecks: checksStatus.totalChecks - checksStatus.passedChecks },
        'Checks pending',
      );
      await this.wait(interval);
    }

    return err(new GitHubAPIError('waitForChecks', `Timeout waiting for PR checks after ${timeout}ms`, undefined));
  }

  /** Get current status of all PR checks */
  private async getChecksStatus(headSha: string, mergeableState: string): Promise<ChecksStatusResult> {
    const { owner, repo } = this.github.getRepository();

    const [statusResponse, checkRunsResponse] = await Promise.all([
      this.github.executeWithRetry('getCombinedStatus', (octokit) =>
        octokit.rest.repos.getCombinedStatusForRef({ owner, repo, ref: headSha }),
      ),
      this.github.executeWithRetry('listCheckRuns', (octokit) =>
        octokit.rest.checks.listForRef({ owner, repo, ref: headSha }),
      ),
    ]);

    const statusChecks = statusResponse.data.statuses;
    const checkRuns = checkRunsResponse.data.check_runs;

    const statusStats = this.countStatusChecks(statusChecks);
    const checkRunStats = this.countCheckRuns(checkRuns);

    const totalChecks = statusStats.total + checkRunStats.total;
    const passedChecks = statusStats.passed + checkRunStats.passed;
    const failedChecks = statusStats.failed + checkRunStats.failed;
    const pendingChecks = statusStats.pending + checkRunStats.pending;

    const failedCheckNames = [
      ...statusChecks.filter((s) => s.state === 'failure' || s.state === 'error').map((s) => s.context),
      ...checkRuns
        .filter((c) => c.conclusion === 'failure' || c.conclusion === 'cancelled' || c.conclusion === 'timed_out')
        .map((c) => c.name),
    ];

    return {
      allPassed: pendingChecks === 0 && failedChecks === 0 && totalChecks > 0,
      pending: pendingChecks > 0,
      totalChecks,
      passedChecks,
      failedChecks,
      mergeableState,
      failedCheckNames: failedCheckNames.length > 0 ? failedCheckNames : undefined,
    };
  }

  // ====================
  // Check Counting Helpers
  // ====================

  /** Count status check results */
  private countStatusChecks(statuses: Array<{ state: string }>): {
    total: number;
    passed: number;
    failed: number;
    pending: number;
  } {
    return {
      total: statuses.length,
      passed: statuses.filter((s) => s.state === 'success').length,
      failed: statuses.filter((s) => s.state === 'failure' || s.state === 'error').length,
      pending: statuses.filter((s) => s.state === 'pending').length,
    };
  }

  /** Count check run results */
  private countCheckRuns(checkRuns: Array<{ status: string; conclusion: string | null }>): {
    total: number;
    passed: number;
    failed: number;
    pending: number;
  } {
    return {
      total: checkRuns.length,
      passed: checkRuns.filter((c) => c.conclusion === 'success').length,
      failed: checkRuns.filter(
        (c) => c.conclusion === 'failure' || c.conclusion === 'cancelled' || c.conclusion === 'timed_out',
      ).length,
      pending: checkRuns.filter((c) => c.status !== 'completed').length,
    };
  }

  // ====================
  // API Helpers
  // ====================

  /** Create PR via API */
  private async createPR(params: CreatePRParams) {
    const { owner, repo } = this.github.getRepository();
    return this.github.executeWithRetry('createPR', (octokit) =>
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
  }

  /** Merge PR via API */
  private async mergePR(params: MergePRParams) {
    const { owner, repo } = this.github.getRepository();
    return this.github.executeWithRetry('mergePR', (octokit) =>
      octokit.rest.pulls.merge({
        owner,
        repo,
        pull_number: params.prNumber,
        merge_method: params.mergeMethod ?? 'merge',
        commit_title: params.commitTitle,
        commit_message: params.commitMessage,
      }),
    );
  }

  /** Fetch PR details */
  private async fetchPR(prNumber: number) {
    const { owner, repo } = this.github.getRepository();
    return this.github.executeWithRetry('getPullRequest', (octokit) =>
      octokit.rest.pulls.get({ owner, repo, pull_number: prNumber }),
    );
  }

  /** List PRs for base and head */
  private async listPRs(params: ExistsPRParams) {
    const { owner, repo } = this.github.getRepository();
    return this.github.executeWithRetry('listPRs', (octokit) =>
      octokit.rest.pulls.list({ owner, repo, state: 'open', base: params.base, head: `${owner}:${params.head}` }),
    );
  }

  // ====================
  // Response Mapping
  // ====================

  /** Map API create response */
  private mapCreateResponse(data: { number: number; html_url: string; state: string }): PRCreateResponse {
    return { number: data.number, htmlUrl: data.html_url, state: data.state };
  }

  /** Map API merge response */
  private mapMergeResponse(data: { merged: boolean; sha: string; message: string }): PRMergeResponse {
    return { merged: data.merged, sha: data.sha, message: data.message };
  }

  // ====================
  // Utilities
  // ====================

  /** Wait for specified milliseconds */
  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Handle and wrap errors */
  private handleError(
    operation: string,
    message: string,
    error: unknown,
    context?: Record<string, unknown>,
  ): Result<never, GitHubAPIError> {
    const apiError = error instanceof GitHubAPIError ? error : new GitHubAPIError(operation, message, undefined, error);
    this.log.error(
      { operation, error: apiError.message, statusCode: apiError.statusCode, ...context },
      `${operation} failed`,
    );
    return err(apiError);
  }

  // ====================
  // PR Body Formatting
  // ====================

  /** Build PR body from workspace tree */
  static buildPRBody(tree: WorkspaceTree): string {
    const sections: string[] = [
      `# Version Update: ${tree.root.workspace.name} ${tree.masterVersion}`,
      '',
      '## 📦 Workspace Versions',
      '',
      `### 🏠 Root: ${tree.root.workspace.name}`,
      `**Version**: \`${tree.root.workspace.version}\`  `,
      `**Path**: \`${tree.root.workspace.path}\`  `,
      `**Type**: \`${tree.root.workspace.type}\`  `,
      '',
    ];

    if (tree.root.children.length > 0) {
      sections.push('### 📁 Child Workspaces', '');
      for (const child of tree.root.children) {
        sections.push(...PRService.formatWorkspaceNode(child, 0));
      }
    }

    return sections.join('\n');
  }

  /** Format workspace node recursively */
  private static formatWorkspaceNode(node: WorkspaceNode, indentLevel: number): string[] {
    const indent = '  '.repeat(indentLevel);
    const changeIndicator = node.workspace.hasChanges ? '🔄' : '✓';

    const lines = [
      `${indent}- ${changeIndicator} **${node.workspace.name}** \`${node.workspace.version}\``,
      `${indent}  - Path: \`${node.workspace.path}\``,
      `${indent}  - Type: \`${node.workspace.type}\``,
    ];

    if (node.children.length > 0) {
      for (const child of node.children) {
        lines.push(...PRService.formatWorkspaceNode(child, indentLevel + 1));
      }
    }

    return lines;
  }
}
