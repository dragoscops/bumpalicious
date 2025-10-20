/**
 * Git Operations Service
 *
 * Provides Git operations using GitHub API (Octokit).
 * Wraps Octokit git endpoints with type-safe interfaces and error handling.
 *
 * Usage:
 * ```typescript
 * const gitService = new GitService(githubService);
 * const tag = await gitService.createTag({
 *   tagName: 'v1.0.0',
 *   message: 'Release 1.0.0',
 *   commitSha: 'abc123'
 * });
 * ```
 */

import type { GitHubService } from './GitHubService.js';
import type {
  GitTag,
  GitCommit,
  GitRef,
  GitComparison,
  CreateTagParams,
  CreateCommitParams,
  UpdateRefParams,
  FileChange,
} from '../types/git.js';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import { GitOperationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Git Operations Service
 *
 * Provides high-level Git operations using GitHub API:
 * - Tag creation and retrieval
 * - Commit creation
 * - Branch/ref updates
 * - File change detection
 */
export class GitService {
  private readonly github: GitHubService;

  /**
   * Create a new Git operations service
   *
   * @param github - GitHub service instance for API access
   *
   * @example
   * ```typescript
   * const github = new GitHubService(token, { repository: { owner, repo } });
   * const git = new GitService(github);
   * ```
   */
  constructor(github: GitHubService) {
    this.github = github;
    logger.debug('GitService initialized');
  }

  /**
   * Get the current commit SHA for a reference (branch or tag)
   *
   * @param ref - Git reference (e.g., 'heads/main', 'tags/v1.0.0')
   * @returns Result with commit SHA
   *
   * @example
   * ```typescript
   * const result = await git.getRef('heads/main');
   * if (result.ok) {
   *   console.log(`Current HEAD: ${result.value.sha}`);
   * }
   * ```
   */
  async getRef(ref: string): Promise<Result<GitRef, GitOperationError>> {
    try {
      const { owner, repo } = this.github.getRepository();

      logger.debug({ ref }, 'Getting Git reference');

      const reference = await this.github.executeWithRetry('getRef', (octokit) =>
        octokit.rest.git.getRef({
          owner,
          repo,
          ref,
        }),
      );

      logger.info({ ref, sha: reference.data.object.sha }, 'Git reference retrieved successfully');

      return ok({
        ref: reference.data.ref,
        sha: reference.data.object.sha,
      });
    } catch (error) {
      const gitError = new GitOperationError('getRef', `Failed to get ref ${ref}`, error);
      logger.error({ error: gitError, ref }, 'Failed to get Git reference');
      return err(gitError);
    }
  }

  /**
   * Create an annotated Git tag
   *
   * Creates both the tag object and the reference.
   *
   * @param params - Tag creation parameters
   * @returns Result with created tag information
   *
   * @example
   * ```typescript
   * const result = await git.createTag({
   *   tagName: 'v1.0.0',
   *   message: 'Release version 1.0.0',
   *   commitSha: 'abc123def456',
   *   taggerName: 'Bot',
   *   taggerEmail: 'bot@example.com'
   * });
   * ```
   */
  async createTag(params: CreateTagParams): Promise<Result<GitTag, GitOperationError>> {
    try {
      const { tagName, message, commitSha, taggerName, taggerEmail } = params;
      const { owner, repo } = this.github.getRepository();

      logger.debug({ tagName, commitSha }, 'Creating Git tag');

      // Create the tag object
      const tagObject = await this.github.executeWithRetry('createTag', (octokit) =>
        octokit.rest.git.createTag({
          owner,
          repo,
          tag: tagName,
          message,
          object: commitSha,
          type: 'commit',
          tagger:
            taggerName && taggerEmail
              ? {
                  name: taggerName,
                  email: taggerEmail,
                  date: new Date().toISOString(),
                }
              : undefined,
        }),
      );

      // Create the reference
      await this.github.executeWithRetry('createTagRef', (octokit) =>
        octokit.rest.git.createRef({
          owner,
          repo,
          ref: `refs/tags/${tagName}`,
          sha: tagObject.data.sha,
        }),
      );

      logger.info({ tagName, sha: tagObject.data.sha }, 'Git tag created successfully');

      return ok({
        name: tagName,
        sha: tagObject.data.sha,
        message,
      });
    } catch (error) {
      const gitError = new GitOperationError('createTag', `Failed to create tag ${params.tagName}`, error);
      logger.error({ error: gitError, tagName: params.tagName }, 'Failed to create Git tag');
      return err(gitError);
    }
  }

  /**
   * Create a Git commit
   *
   * Creates a commit object with the specified tree and parents.
   *
   * @param params - Commit creation parameters
   * @returns Result with created commit information
   *
   * @example
   * ```typescript
   * const result = await git.createCommit({
   *   message: 'chore: bump version',
   *   tree: 'tree-sha',
   *   parents: ['parent-sha'],
   *   author: { name: 'Bot', email: 'bot@example.com' }
   * });
   * ```
   */
  async createCommit(params: CreateCommitParams): Promise<Result<GitCommit, GitOperationError>> {
    try {
      const { message, tree, parents, author } = params;
      const { owner, repo } = this.github.getRepository();

      logger.debug({ message, tree, parentsCount: parents.length }, 'Creating Git commit');

      const commit = await this.github.executeWithRetry('createCommit', (octokit) =>
        octokit.rest.git.createCommit({
          owner,
          repo,
          message,
          tree,
          parents: [...parents],
          author: author
            ? {
                name: author.name,
                email: author.email,
                date: new Date().toISOString(),
              }
            : undefined,
        }),
      );

      logger.info({ sha: commit.data.sha, message }, 'Git commit created successfully');

      return ok({
        sha: commit.data.sha,
        message: commit.data.message,
        author: {
          name: commit.data.author.name,
          email: commit.data.author.email,
        },
        date: commit.data.author.date,
      });
    } catch (error) {
      const gitError = new GitOperationError('createCommit', 'Failed to create commit', error);
      logger.error({ error: gitError, message: params.message }, 'Failed to create Git commit');
      return err(gitError);
    }
  }

  /**
   * Update a Git reference (branch or tag)
   *
   * Points a reference to a new commit SHA.
   *
   * @param params - Reference update parameters
   * @returns Result with updated reference information
   *
   * @example
   * ```typescript
   * const result = await git.updateRef({
   *   ref: 'heads/main',
   *   sha: 'new-commit-sha',
   *   force: false
   * });
   * ```
   */
  async updateRef(params: UpdateRefParams): Promise<Result<GitRef, GitOperationError>> {
    try {
      const { ref, sha, force = false } = params;
      const { owner, repo } = this.github.getRepository();

      logger.debug({ ref, sha, force }, 'Updating Git reference');

      const reference = await this.github.executeWithRetry('updateRef', (octokit) =>
        octokit.rest.git.updateRef({
          owner,
          repo,
          ref,
          sha,
          force,
        }),
      );

      logger.info({ ref, sha }, 'Git reference updated successfully');

      return ok({
        ref: reference.data.ref,
        sha: reference.data.object.sha,
      });
    } catch (error) {
      const gitError = new GitOperationError('updateRef', `Failed to update ref ${params.ref}`, error);
      logger.error({ error: gitError, ref: params.ref }, 'Failed to update Git reference');
      return err(gitError);
    }
  }

  /**
   * Get file changes between two commits
   *
   * Compares two commits and returns the list of changed files.
   * Optionally filters changes to a specific path.
   *
   * @param base - Base commit SHA or ref
   * @param head - Head commit SHA or ref
   * @param path - Optional path filter (e.g., 'packages/api')
   * @returns Result with file changes and commit information
   *
   * @example
   * ```typescript
   * const result = await git.getChangedFiles('v1.0.0', 'HEAD', 'packages/api');
   * if (result.ok) {
   *   console.log(`Found ${result.value.files.length} changed files`);
   * }
   * ```
   */
  async getChangedFiles(base: string, head: string, path?: string): Promise<Result<GitComparison, GitOperationError>> {
    try {
      const { owner, repo } = this.github.getRepository();

      logger.debug({ base, head, path }, 'Getting changed files');

      const comparison = await this.github.executeWithRetry('compareCommits', (octokit) =>
        octokit.rest.repos.compareCommits({
          owner,
          repo,
          base,
          head,
        }),
      );

      // Filter files by path if specified
      let files = comparison.data.files || [];
      const rawCommits = comparison.data.commits || [];

      logger.info(
        {
          base,
          head,
          status: comparison.data.status,
          ahead_by: comparison.data.ahead_by,
          behind_by: comparison.data.behind_by,
          total_commits: comparison.data.total_commits,
          files_count: files.length,
          commits_count: rawCommits.length,
          file_names: files.map((f) => f.filename),
          commit_messages: rawCommits.map((c) => c.commit.message.split('\n')[0]),
        },
        'Comparison API response',
      );

      logger.debug({ totalFiles: files.length, filterPath: path }, 'Files before filtering');

      if (path) {
        const normalizedPath = path.endsWith('/') ? path : `${path}/`;
        files = files.filter((file) => file.filename.startsWith(normalizedPath));
        logger.debug({ filteredFiles: files.length, normalizedPath }, 'Files after path filtering');
      }

      const fileChanges: FileChange[] = files.map((file) => ({
        path: file.filename,
        status: file.status as FileChange['status'],
        additions: file.additions,
        deletions: file.deletions,
      }));

      const commits: GitCommit[] = rawCommits.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author?.name || 'Unknown',
          email: commit.commit.author?.email || 'unknown@example.com',
        },
        date: commit.commit.author?.date || new Date().toISOString(),
      }));

      logger.info(
        { base, head, filesCount: fileChanges.length, commitsCount: commits.length },
        'Retrieved changed files',
      );

      return ok({
        base,
        head,
        files: fileChanges,
        commits,
      });
    } catch (error) {
      const gitError = new GitOperationError(
        'getChangedFiles',
        `Failed to get changed files between ${base} and ${head}`,
        error,
      );
      logger.error({ error: gitError, base, head }, 'Failed to get changed files');
      return err(gitError);
    }
  }

  /**
   * Get the most recent tag in the repository
   *
   * Returns the first tag from the list (most recent by creation).
   *
   * @returns Result with tag information, or null if no tags exist
   *
   * @example
   * ```typescript
   * const result = await git.getLastTag();
   * if (result.ok && result.value) {
   *   console.log(`Last tag: ${result.value.name}`);
   * }
   * ```
   */
  async getLastTag(): Promise<Result<GitTag | null, GitOperationError>> {
    try {
      const { owner, repo } = this.github.getRepository();

      logger.debug('Getting last tag');

      const tags = await this.github.executeWithRetry('listTags', (octokit) =>
        octokit.rest.repos.listTags({
          owner,
          repo,
          per_page: 1,
        }),
      );

      if (tags.data.length === 0) {
        logger.info('No tags found in repository');
        return ok(null);
      }

      const lastTag: GitTag = {
        name: tags.data[0].name,
        sha: tags.data[0].commit.sha,
      };

      logger.info({ tagName: lastTag.name, sha: lastTag.sha }, 'Retrieved last tag');

      return ok(lastTag);
    } catch (error) {
      const gitError = new GitOperationError('getLastTag', 'Failed to get last tag', error);
      logger.error({ error: gitError }, 'Failed to get last tag');
      return err(gitError);
    }
  }

  /**
   * Get commits between two references
   *
   * Retrieves commit history between base and head.
   *
   * @param base - Base commit SHA or ref
   * @param head - Head commit SHA or ref (default: 'HEAD')
   * @returns Result with list of commits
   *
   * @example
   * ```typescript
   * const result = await git.getCommitsSince('v1.0.0');
   * if (result.ok) {
   *   result.value.forEach(commit => console.log(commit.message));
   * }
   * ```
   */
  async getCommitsSince(base: string, head: string = 'HEAD'): Promise<Result<readonly GitCommit[], GitOperationError>> {
    try {
      logger.debug({ base, head }, 'Getting commits');

      const comparison = await this.getChangedFiles(base, head);

      if (!comparison.ok) {
        return err(comparison.error);
      }

      logger.info({ base, head, count: comparison.value.commits.length }, 'Retrieved commits');

      return ok(comparison.value.commits);
    } catch (error) {
      const gitError = new GitOperationError('getCommitsSince', `Failed to get commits since ${base}`, error);
      logger.error({ error: gitError, base, head }, 'Failed to get commits');
      return err(gitError);
    }
  }
}
