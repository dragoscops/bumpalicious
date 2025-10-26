/** GitHub API wrapper with retry logic and rate limiting */

import { getOctokit } from '@actions/github';
import type { GitHub } from '@actions/github/lib/utils.js';
import { GitHubAPIError } from '../utils/errors.js';
import { Loggable } from '../utils/Loggable.js';
import { retry, type RetryOptions } from '../utils/retry.js';

export interface RepositoryContext {
  readonly owner: string;
  readonly repo: string;
}

export interface GitHubServiceConfig {
  readonly repository: RepositoryContext;
  readonly retryOptions?: Partial<RetryOptions>;
}

export type OctokitInstance = InstanceType<typeof GitHub>;

/** GitHub API wrapper with automatic retry and rate limiting */
export class GitHubService extends Loggable {
  private readonly octokit: OctokitInstance;
  private readonly repository: RepositoryContext;
  private readonly retryOptions: Partial<RetryOptions>;

  constructor(token: string, config: GitHubServiceConfig) {
    super();
    this.octokit = getOctokit(token);
    this.repository = config.repository;
    this.retryOptions = config.retryOptions ?? {};
    this.log.info({ owner: this.repository.owner, repo: this.repository.repo }, 'GitHubService initialized');
  }

  // ====================
  // Public API
  // ====================

  /** Get Octokit instance for direct API access */
  getOctokit(): OctokitInstance {
    this.log.debug('Returning Octokit instance for direct API access');
    return this.octokit;
  }

  /** Get repository context */
  getRepository(): RepositoryContext {
    this.log.debug({ owner: this.repository.owner, repo: this.repository.repo }, 'Returning repository context');
    return { ...this.repository };
  }

  /** Execute API operation with retry logic */
  async executeWithRetry<T>(operationName: string, operation: (octokit: OctokitInstance) => Promise<T>): Promise<T> {
    this.log.debug({ operation: operationName, retryOptions: this.retryOptions }, 'Executing with retry');

    try {
      const result = await this.executeOperation(operationName, operation);
      this.log.debug({ operation: operationName }, 'Operation succeeded');
      return result;
    } catch (error) {
      return this.handleOperationError(operationName, error);
    }
  }

  // ====================
  // GitHub Operations
  // ====================

  /** Delete branch from repository */
  async deleteBranch(branchName: string): Promise<void> {
    this.log.debug({ branchName }, 'Deleting branch');

    try {
      await this.executeWithRetry('deleteBranch', (octokit) =>
        octokit.rest.git.deleteRef({
          owner: this.repository.owner,
          repo: this.repository.repo,
          ref: `heads/${branchName}`,
        }),
      );

      this.log.info({ branchName }, 'Branch deleted');
    } catch (error) {
      throw this.wrapDeleteBranchError(branchName, error);
    }
  }

  // ====================
  // Rate Limiting
  // ====================

  /** Get current rate limit status */
  async getRateLimit(): Promise<{ limit: number; remaining: number; reset: number; used: number }> {
    this.log.debug('Fetching rate limit');

    try {
      const response = await this.octokit.rest.rateLimit.get();
      const rateLimit = {
        limit: response.data.rate.limit,
        remaining: response.data.rate.remaining,
        reset: response.data.rate.reset,
        used: response.data.rate.used,
      };

      this.log.debug({ ...rateLimit, resetAt: new Date(rateLimit.reset * 1000).toISOString() }, 'Rate limit retrieved');
      return rateLimit;
    } catch (error) {
      throw this.wrapGitHubError('getRateLimit', error);
    }
  }

  /** Wait for rate limit reset if below threshold */
  async checkRateLimit(threshold: number = 10): Promise<boolean> {
    this.log.debug({ threshold }, 'Checking rate limit');

    try {
      const rateLimit = await this.getRateLimit();

      if (rateLimit.remaining >= threshold) {
        this.log.debug({ remaining: rateLimit.remaining, threshold }, 'Rate limit sufficient');
        return false;
      }

      return await this.waitForRateLimitReset(rateLimit);
    } catch (error) {
      this.log.warn({ error }, 'Failed to check rate limit');
      return false;
    }
  }

  /** Wait for rate limit to reset */
  private async waitForRateLimitReset(rateLimit: { remaining: number; reset: number }): Promise<boolean> {
    const resetDate = new Date(rateLimit.reset * 1000);
    const waitMs = resetDate.getTime() - Date.now();

    if (waitMs <= 0) return false;

    this.log.warn(
      { remaining: rateLimit.remaining, resetAt: resetDate.toISOString(), waitMs },
      'Rate limit approaching, waiting',
    );

    await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.log.info('Rate limit reset');
    return true;
  }

  // ====================
  // Operation Execution
  // ====================

  /** Execute operation with retry wrapper */
  private async executeOperation<T>(
    operationName: string,
    operation: (octokit: OctokitInstance) => Promise<T>,
  ): Promise<T> {
    return retry(
      async () => {
        try {
          return await operation(this.octokit);
        } catch (error) {
          throw this.wrapGitHubError(operationName, error);
        }
      },
      { ...this.retryOptions, operationName },
    );
  }

  /** Handle operation execution error */
  private handleOperationError(operationName: string, error: unknown): never {
    const wrapped = error instanceof GitHubAPIError ? error : this.wrapGitHubError(operationName, error);

    this.log.error(
      { code: wrapped.code, statusCode: wrapped.statusCode, message: wrapped.message },
      `Operation failed: ${operationName}`,
    );

    throw wrapped;
  }

  // ====================
  // Error Handling
  // ====================

  /** Wrap GitHub API error with context */
  private wrapGitHubError(operation: string, error: unknown): GitHubAPIError {
    if (error instanceof GitHubAPIError) {
      this.log.debug({ operation, errorCode: error.code }, 'Error already wrapped');
      return error;
    }

    const statusCode = this.extractStatusCode(error);
    const message = error instanceof Error ? error.message : String(error);

    this.log.debug(
      { operation, statusCode, errorType: error instanceof Error ? error.constructor.name : typeof error },
      'Wrapping error',
    );

    return new GitHubAPIError(operation, message, statusCode, error);
  }

  /** Wrap branch deletion error */
  private wrapDeleteBranchError(branchName: string, error: unknown): never {
    const apiError =
      error instanceof GitHubAPIError
        ? error
        : new GitHubAPIError('deleteBranch', 'Failed to delete branch', undefined, error);

    this.log.error(
      { operation: 'deleteBranch', branchName, error: apiError.message, statusCode: apiError.statusCode },
      'Branch deletion failed',
    );

    throw apiError;
  }

  /** Extract status code from error object */
  private extractStatusCode(error: unknown): number | undefined {
    if (error && typeof error === 'object' && 'status' in error) {
      return typeof error.status === 'number' ? error.status : undefined;
    }
    return undefined;
  }
}
