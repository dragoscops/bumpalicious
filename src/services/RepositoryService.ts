/**
 * Repository Service
 *
 * Service for repository queries and file operations using GitHub API.
 * Provides methods for file content retrieval, file updates, and commit history.
 *
 * Usage:
 * ```typescript
 * const repoService = new RepositoryService(githubService);
 *
 * const contentResult = await repoService.getFileContent({
 *   path: 'package.json',
 *   ref: 'main'
 * });
 * ```
 */

import type { GitHubService } from './GitHubService.js';
import type {
  FileContent,
  GetFileContentParams,
  UpdateFileParams,
  FileUpdateResponse,
  GitCommit,
} from '../types/git.js';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import { GitOperationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Repository Service
 *
 * Provides high-level repository operations using GitHub API:
 * - File content retrieval
 * - File updates
 * - Commit history queries
 */
export class RepositoryService {
  private readonly github: GitHubService;

  /**
   * Create a new repository service instance
   *
   * @param github - GitHub service instance for API access
   *
   * @example
   * ```typescript
   * const github = new GitHubService(token, { repository: { owner, repo } });
   * const repoService = new RepositoryService(github);
   * ```
   */
  constructor(github: GitHubService) {
    this.github = github;
    logger.debug('RepositoryService initialized');
  }

  /**
   * Get file content from repository
   *
   * Retrieves the content of a file at a specific path and optional ref.
   * Content is automatically decoded from base64 to UTF-8.
   *
   * @param params - File content retrieval parameters
   * @returns Result with file content or error
   *
   * @example
   * ```typescript
   * const result = await repoService.getFileContent({
   *   path: 'package.json',
   *   ref: 'main'
   * });
   *
   * if (result.ok) {
   *   console.log(result.value.content);
   * }
   * ```
   */
  async getFileContent(params: GetFileContentParams): Promise<Result<FileContent, GitOperationError>> {
    try {
      const { path, ref } = params;
      const { owner, repo } = this.github.getRepository();

      logger.debug({ path, ref }, 'Getting file content');

      const response = await this.github.executeWithRetry('getContent', (octokit) =>
        octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref,
        }),
      );

      // Ensure response is a file (not directory or symlink)
      if (!('content' in response.data) || Array.isArray(response.data)) {
        const error = new GitOperationError('getFileContent', `Path ${path} is not a file`, undefined);
        logger.error({ path }, 'Path is not a file');
        return err(error);
      }

      // Decode base64 content
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');

      const fileContent: FileContent = {
        path: response.data.path,
        content,
        encoding: 'utf-8',
        sha: response.data.sha,
        size: response.data.size,
      };

      logger.info({ path, size: fileContent.size }, 'File content retrieved successfully');

      return ok(fileContent);
    } catch (error) {
      const gitError = new GitOperationError('getFileContent', `Failed to get content for ${params.path}`, error);
      logger.error({ error: gitError, path: params.path }, 'Failed to get file content');
      return err(gitError);
    }
  }

  /**
   * Update file content in repository
   *
   * Creates or updates a file with new content.
   * Requires the file's SHA if updating an existing file.
   *
   * @param params - File update parameters
   * @returns Result with update response or error
   *
   * @example
   * ```typescript
   * const result = await repoService.updateFile({
   *   path: 'VERSION',
   *   content: '1.0.0',
   *   message: 'chore: bump version to 1.0.0',
   *   sha: 'existing-file-sha',
   *   branch: 'main'
   * });
   * ```
   */
  async updateFile(params: UpdateFileParams): Promise<Result<FileUpdateResponse, GitOperationError>> {
    try {
      const { path, content, message, sha, branch } = params;
      const { owner, repo } = this.github.getRepository();

      logger.debug({ path, message, branch }, 'Updating file');

      // Encode content to base64
      const encodedContent = Buffer.from(content, 'utf-8').toString('base64');

      const response = await this.github.executeWithRetry('updateFile', (octokit) =>
        octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path,
          message,
          content: encodedContent,
          sha,
          branch,
        }),
      );

      const result: FileUpdateResponse = {
        sha: response.data.content?.sha || '',
        commit: {
          sha: response.data.commit.sha || '',
          message: response.data.commit.message || message,
        },
      };

      logger.info(
        {
          path,
          commitSha: result.commit.sha,
          fileSha: result.sha,
        },
        'File updated successfully',
      );

      return ok(result);
    } catch (error) {
      const gitError = new GitOperationError('updateFile', `Failed to update file ${params.path}`, error);
      logger.error({ error: gitError, path: params.path }, 'Failed to update file');
      return err(gitError);
    }
  }

  /**
   * Get commit history for repository
   *
   * Retrieves a list of commits, optionally filtered by path and ref.
   *
   * @param options - Query options
   * @param options.sha - SHA or branch to start listing from (default: default branch)
   * @param options.path - Filter commits to specific path
   * @param options.perPage - Number of commits per page (default: 30, max: 100)
   * @param options.page - Page number for pagination (default: 1)
   * @returns Result with array of commits or error
   *
   * @example
   * ```typescript
   * const result = await repoService.getCommits({
   *   sha: 'main',
   *   path: 'packages/api',
   *   perPage: 50
   * });
   *
   * if (result.ok) {
   *   result.value.forEach(commit => console.log(commit.message));
   * }
   * ```
   */
  async getCommits(options?: {
    sha?: string;
    path?: string;
    perPage?: number;
    page?: number;
  }): Promise<Result<readonly GitCommit[], GitOperationError>> {
    try {
      const { owner, repo } = this.github.getRepository();
      const { sha, path, perPage = 30, page = 1 } = options || {};

      logger.debug({ sha, path, perPage, page }, 'Getting commits');

      const response = await this.github.executeWithRetry('listCommits', (octokit) =>
        octokit.rest.repos.listCommits({
          owner,
          repo,
          sha,
          path,
          per_page: Math.min(perPage, 100), // GitHub API max is 100
          page,
        }),
      );

      const commits: GitCommit[] = response.data.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author?.name || 'Unknown',
          email: commit.commit.author?.email || 'unknown@example.com',
        },
        date: commit.commit.author?.date || new Date().toISOString(),
      }));

      logger.info(
        {
          sha,
          path,
          count: commits.length,
        },
        'Retrieved commits',
      );

      return ok(commits);
    } catch (error) {
      const gitError = new GitOperationError('getCommits', 'Failed to get commits', error);
      logger.error({ error: gitError }, 'Failed to get commits');
      return err(gitError);
    }
  }
}
