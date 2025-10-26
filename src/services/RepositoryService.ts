/** Repository service for file operations and commit history via GitHub API */

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

/** Repository service for file operations and commit history */
export class RepositoryService {
  private readonly github: GitHubService;
  private readonly log = logger.child({ service: 'RepositoryService' });

  constructor(github: GitHubService) {
    this.github = github;
    this.log.debug('RepositoryService initialized');
  }

  // ====================
  // Public API
  // ====================

  /** Get file content from repository */
  async getFileContent(params: GetFileContentParams): Promise<Result<FileContent, GitOperationError>> {
    this.log.debug({ path: params.path, ref: params.ref }, 'Getting file content');

    try {
      const response = await this.fetchFileContent(params);

      if (!this.isFileResponse(response.data)) {
        return this.handleNotAFileError(params.path);
      }

      const fileContent = this.decodeFileContent(response.data);
      this.log.info({ path: params.path, size: fileContent.size }, 'File content retrieved');
      return ok(fileContent);
    } catch (error) {
      return this.handleError('getFileContent', `Failed to get content for ${params.path}`, error, {
        path: params.path,
      });
    }
  }

  /** Update or create file in repository */
  async updateFile(params: UpdateFileParams): Promise<Result<FileUpdateResponse, GitOperationError>> {
    this.log.debug({ path: params.path, message: params.message, branch: params.branch }, 'Updating file');

    try {
      const response = await this.commitFileUpdate(params);
      const result = this.mapUpdateResponse(response.data, params.message);

      this.log.info({ path: params.path, commitSha: result.commit.sha, fileSha: result.sha }, 'File updated');
      return ok(result);
    } catch (error) {
      return this.handleError('updateFile', `Failed to update file ${params.path}`, error, { path: params.path });
    }
  }

  /** Get commit history for repository */
  async getCommits(options?: {
    sha?: string;
    path?: string;
    perPage?: number;
    page?: number;
  }): Promise<Result<readonly GitCommit[], GitOperationError>> {
    const { sha, path, perPage = 30, page = 1 } = options || {};
    this.log.debug({ sha, path, perPage, page }, 'Getting commits');

    try {
      const response = await this.fetchCommits(sha, path, perPage, page);
      const commits = this.mapCommits(response.data);

      this.log.info({ sha, path, count: commits.length }, 'Retrieved commits');
      return ok(commits);
    } catch (error) {
      return this.handleError('getCommits', 'Failed to get commits', error);
    }
  }

  // ====================
  // API Helpers
  // ====================

  /** Fetch file content via API */
  private async fetchFileContent(params: GetFileContentParams) {
    const { owner, repo } = this.github.getRepository();
    return this.github.executeWithRetry('getContent', (octokit) =>
      octokit.rest.repos.getContent({ owner, repo, path: params.path, ref: params.ref }),
    );
  }

  /** Commit file update via API */
  private async commitFileUpdate(params: UpdateFileParams) {
    const { owner, repo } = this.github.getRepository();
    const encodedContent = Buffer.from(params.content, 'utf-8').toString('base64');

    return this.github.executeWithRetry('updateFile', (octokit) =>
      octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: params.path,
        message: params.message,
        content: encodedContent,
        sha: params.sha,
        branch: params.branch,
      }),
    );
  }

  /** Fetch commits via API */
  private async fetchCommits(sha?: string, path?: string, perPage = 30, page = 1) {
    const { owner, repo } = this.github.getRepository();
    return this.github.executeWithRetry('listCommits', (octokit) =>
      octokit.rest.repos.listCommits({
        owner,
        repo,
        sha,
        path,
        per_page: Math.min(perPage, 100),
        page,
      }),
    );
  }

  // ====================
  // Response Validation
  // ====================

  /** Check if API response is a file */
  private isFileResponse(data: unknown): data is { content: string; path: string; sha: string; size: number } {
    return typeof data === 'object' && data !== null && 'content' in data && !Array.isArray(data);
  }

  // ====================
  // Data Transformation
  // ====================

  /** Decode file content from base64 */
  private decodeFileContent(data: { content: string; path: string; sha: string; size: number }): FileContent {
    return {
      path: data.path,
      content: Buffer.from(data.content, 'base64').toString('utf-8'),
      encoding: 'utf-8',
      sha: data.sha,
      size: data.size,
    };
  }

  /** Map API update response */
  private mapUpdateResponse(
    data: { content?: { sha?: string } | null; commit: { sha?: string; message?: string } },
    defaultMessage: string,
  ): FileUpdateResponse {
    return {
      sha: data.content?.sha || '',
      commit: {
        sha: data.commit.sha || '',
        message: data.commit.message || defaultMessage,
      },
    };
  }

  /** Map API commits to domain model */
  private mapCommits(
    data: Array<{
      sha: string;
      commit: { message: string; author?: { name?: string; email?: string; date?: string } | null };
    }>,
  ): GitCommit[] {
    return data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: {
        name: commit.commit.author?.name || 'Unknown',
        email: commit.commit.author?.email || 'unknown@example.com',
      },
      date: commit.commit.author?.date || new Date().toISOString(),
    }));
  }

  // ====================
  // Error Handling
  // ====================

  /** Handle "not a file" error */
  private handleNotAFileError(path: string): Result<never, GitOperationError> {
    const error = new GitOperationError('getFileContent', `Path ${path} is not a file`, undefined);
    this.log.error({ path }, 'Path is not a file');
    return err(error);
  }

  /** Handle and wrap errors */
  private handleError(
    operation: string,
    message: string,
    error: unknown,
    context?: Record<string, unknown>,
  ): Result<never, GitOperationError> {
    const gitError = new GitOperationError(operation, message, error);
    this.log.error({ error: gitError, ...context }, `${operation} failed`);
    return err(gitError);
  }
}
