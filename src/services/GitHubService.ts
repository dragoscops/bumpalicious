/**
 * GitHub API Service
 *
 * Wrapper service for GitHub API (Octokit) with retry logic and rate limiting.
 * Provides type-safe GitHub operations with automatic error handling.
 *
 * Usage:
 * ```typescript
 * const github = new GitHubService(token, { owner: 'user', repo: 'project' });
 * const result = await github.executeWithRetry(
 *   'getRepository',
 *   (octokit) => octokit.rest.repos.get({ owner, repo })
 * );
 * ```
 */

import { getOctokit } from '@actions/github';
import type { GitHub } from '@actions/github/lib/utils.js';
import { retry, type RetryOptions } from '../utils/retry.js';
import { GitHubAPIError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Repository context information
 */
export interface RepositoryContext {
  /**
   * Repository owner (user or organization)
   */
  readonly owner: string;

  /**
   * Repository name
   */
  readonly repo: string;
}

/**
 * GitHub service configuration
 */
export interface GitHubServiceConfig {
  /**
   * Repository context
   */
  readonly repository: RepositoryContext;

  /**
   * Custom retry options (optional)
   */
  readonly retryOptions?: Partial<RetryOptions>;
}

/**
 * Type alias for Octokit instance
 */
export type OctokitInstance = InstanceType<typeof GitHub>;

/**
 * GitHub API Service
 *
 * Provides wrapper around Octokit with:
 * - Automatic retry logic for recoverable errors
 * - Rate limit handling
 * - Type-safe API access
 * - Structured error handling
 */
export class GitHubService {
  private readonly octokit: OctokitInstance;
  private readonly repository: RepositoryContext;
  private readonly retryOptions: Partial<RetryOptions>;

  /**
   * Create a new GitHub service instance
   *
   * @param token - GitHub API token (PAT or Actions token)
   * @param config - Service configuration
   *
   * @example
   * ```typescript
   * const github = new GitHubService(process.env.GITHUB_TOKEN!, {
   *   repository: { owner: 'myorg', repo: 'myrepo' }
   * });
   * ```
   */
  constructor(token: string, config: GitHubServiceConfig) {
    this.octokit = getOctokit(token);
    this.repository = config.repository;
    this.retryOptions = config.retryOptions ?? {};

    logger.info(
      {
        owner: this.repository.owner,
        repo: this.repository.repo,
      },
      'GitHubService initialized',
    );
  }

  /**
   * Get the Octokit instance
   *
   * Use this for direct API access when needed.
   * Prefer using executeWithRetry() for automatic retry logic.
   *
   * @returns Octokit instance
   */
  getOctokit(): OctokitInstance {
    return this.octokit;
  }

  /**
   * Get repository context
   *
   * @returns Repository owner and name
   */
  getRepository(): RepositoryContext {
    return { ...this.repository };
  }

  /**
   * Execute GitHub API operation with automatic retry logic
   *
   * Wraps the operation in retry logic with exponential backoff.
   * Automatically handles rate limiting and transient failures.
   *
   * @param operationName - Human-readable operation name for logging
   * @param operation - Function that executes the GitHub API call
   * @returns Promise with operation result
   * @throws {GitHubAPIError} If operation fails after all retries
   *
   * @example
   * ```typescript
   * const tags = await github.executeWithRetry(
   *   'listTags',
   *   (octokit) => octokit.rest.repos.listTags({
   *     owner: github.getRepository().owner,
   *     repo: github.getRepository().repo
   *   })
   * );
   * ```
   */
  async executeWithRetry<T>(operationName: string, operation: (octokit: OctokitInstance) => Promise<T>): Promise<T> {
    logger.debug(`Executing GitHub API operation: ${operationName}`);

    try {
      const result = await retry(
        async () => {
          try {
            return await operation(this.octokit);
          } catch (error) {
            // Convert to GitHubAPIError for consistent error handling
            throw this.wrapGitHubError(operationName, error);
          }
        },
        {
          ...this.retryOptions,
          operationName,
        },
      );

      logger.debug(`GitHub API operation succeeded: ${operationName}`);
      return result;
    } catch (error) {
      // Error already wrapped by retry logic
      if (error instanceof GitHubAPIError) {
        logger.error(
          {
            code: error.code,
            statusCode: error.statusCode,
            message: error.message,
          },
          `GitHub API operation failed: ${operationName}`,
        );
        throw error;
      }

      // Wrap unexpected errors
      const wrapped = this.wrapGitHubError(operationName, error);
      logger.error(
        {
          code: wrapped.code,
          message: wrapped.message,
        },
        `GitHub API operation failed: ${operationName}`,
      );
      throw wrapped;
    }
  }

  /**
   * Check current rate limit status
   *
   * @returns Rate limit information
   * @throws {GitHubAPIError} If unable to fetch rate limit
   *
   * @example
   * ```typescript
   * const rateLimit = await github.getRateLimit();
   * console.log(`Remaining: ${rateLimit.remaining}/${rateLimit.limit}`);
   * console.log(`Resets at: ${new Date(rateLimit.reset * 1000)}`);
   * ```
   */
  async getRateLimit(): Promise<{
    limit: number;
    remaining: number;
    reset: number;
    used: number;
  }> {
    try {
      const response = await this.octokit.rest.rateLimit.get();
      return {
        limit: response.data.rate.limit,
        remaining: response.data.rate.remaining,
        reset: response.data.rate.reset,
        used: response.data.rate.used,
      };
    } catch (error) {
      throw this.wrapGitHubError('getRateLimit', error);
    }
  }

  /**
   * Wait until rate limit resets if approaching limit
   *
   * @param threshold - Minimum remaining requests before waiting (default: 10)
   * @returns True if waited, false if rate limit sufficient
   *
   * @example
   * ```typescript
   * await github.checkRateLimit(50); // Wait if less than 50 requests remaining
   * ```
   */
  async checkRateLimit(threshold: number = 10): Promise<boolean> {
    try {
      const rateLimit = await this.getRateLimit();

      if (rateLimit.remaining < threshold) {
        const resetDate = new Date(rateLimit.reset * 1000);
        const waitMs = resetDate.getTime() - Date.now();

        if (waitMs > 0) {
          logger.warn(
            {
              remaining: rateLimit.remaining,
              resetAt: resetDate.toISOString(),
              waitMs,
            },
            'Rate limit approaching, waiting for reset',
          );

          await new Promise((resolve) => setTimeout(resolve, waitMs));
          logger.info('Rate limit reset, continuing');
          return true;
        }
      }

      return false;
    } catch (error) {
      // Don't fail on rate limit check errors, just log
      logger.warn({ error }, 'Failed to check rate limit');
      return false;
    }
  }

  /**
   * Wrap GitHub API errors into GitHubAPIError
   *
   * Extracts status code and message from various error formats.
   *
   * @param operation - Operation name
   * @param error - Original error
   * @returns Wrapped GitHubAPIError
   */
  private wrapGitHubError(operation: string, error: unknown): GitHubAPIError {
    // Already wrapped
    if (error instanceof GitHubAPIError) {
      return error;
    }

    // Extract status code and message from Octokit errors
    let statusCode: number | undefined;
    let message: string;

    if (error && typeof error === 'object' && 'status' in error) {
      statusCode = typeof error.status === 'number' ? error.status : undefined;
    }

    if (error instanceof Error) {
      message = error.message;
    } else {
      message = String(error);
    }

    return new GitHubAPIError(operation, message, statusCode, error);
  }
}
