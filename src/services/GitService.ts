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
import { Loggable } from '../Loggable.js';
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

/**
 * Git Operations Service
 *
 * Provides high-level Git operations using GitHub API:
 * - Tag creation and retrieval
 * - Commit creation
 * - Branch/ref updates
 * - File change detection
 */
export class GitService extends Loggable {
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
    super();
    this.github = github;
    this.log.info(
      {
        ...github.getRepository(),
      },
      'GitService initialized',
    );
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
    this.log.debug(
      {
        ref,
      },
      'Getting Git reference',
    );

    try {
      const { owner, repo } = this.github.getRepository();

      const reference = await this.github.executeWithRetry('getRef', (octokit) =>
        octokit.rest.git.getRef({
          owner,
          repo,
          ref,
        }),
      );

      this.log.info(
        {
          ref,
          ...reference.data.object,
        },
        'Git reference retrieved successfully',
      );

      return ok({
        ref: reference.data.ref,
        sha: reference.data.object.sha,
      });
    } catch (error) {
      const gitError = new GitOperationError('getRef', `Failed to get ref ${ref}`, error);
      this.log.error({ error: gitError, ref }, 'Failed to get Git reference');
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
    this.log.debug(
      {
        tagName: params.tagName,
        commitSha: params.commitSha,
        message: params.message,
        hasTagger: !!(params.taggerName && params.taggerEmail),
      },
      'Creating Git tag',
    );

    try {
      const { tagName, message, commitSha, taggerName, taggerEmail } = params;
      const { owner, repo } = this.github.getRepository();

      // Create the tag object
      this.log.debug({ tagName }, 'Creating tag object');
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

      this.log.debug(
        {
          tagName,
          tagSha: tagObject.data.sha,
        },
        'Tag object created, creating reference',
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

      this.log.info(
        {
          tagName,
          sha: tagObject.data.sha,
          commitSha,
        },
        'Git tag created successfully',
      );

      return ok({
        name: tagName,
        sha: tagObject.data.sha,
        message,
      });
    } catch (error) {
      const gitError = new GitOperationError('createTag', `Failed to create tag ${params.tagName}`, error);
      this.log.error({ error: gitError, tagName: params.tagName }, 'Failed to create Git tag');
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
    this.log.debug(
      {
        message: params.message,
        tree: params.tree,
        parentsCount: params.parents.length,
        hasAuthor: !!params.author,
      },
      'Creating Git commit',
    );

    try {
      const { message, tree, parents, author } = params;
      const { owner, repo } = this.github.getRepository();

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

      this.log.info(
        {
          sha: commit.data.sha,
          message: commit.data.message,
          author: commit.data.author.name,
        },
        'Git commit created successfully',
      );

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
      this.log.error({ error: gitError, message: params.message }, 'Failed to create Git commit');
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
    this.log.debug(
      {
        ref: params.ref,
        sha: params.sha,
        force: params.force ?? false,
      },
      'Updating Git reference',
    );

    try {
      const { ref, sha, force = false } = params;
      const { owner, repo } = this.github.getRepository();

      const reference = await this.github.executeWithRetry('updateRef', (octokit) =>
        octokit.rest.git.updateRef({
          owner,
          repo,
          ref,
          sha,
          force,
        }),
      );

      this.log.info(
        {
          ref,
          sha,
          updatedSha: reference.data.object.sha,
        },
        'Git reference updated successfully',
      );

      return ok({
        ref: reference.data.ref,
        sha: reference.data.object.sha,
      });
    } catch (error) {
      const gitError = new GitOperationError('updateRef', `Failed to update ref ${params.ref}`, error);
      this.log.error({ error: gitError, ref: params.ref }, 'Failed to update Git reference');
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
    this.log.debug(
      {
        base,
        head,
        path: path || 'all',
      },
      'Getting changed files between commits',
    );

    try {
      const { owner, repo } = this.github.getRepository();

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

      this.log.debug(
        {
          base,
          head,
          status: comparison.data.status,
          aheadBy: comparison.data.ahead_by,
          behindBy: comparison.data.behind_by,
          totalCommits: comparison.data.total_commits,
          totalFiles: files.length,
        },
        'Comparison API response received',
      );

      if (path) {
        const normalizedPath = path.endsWith('/') ? path : `${path}/`;
        const originalCount = files.length;
        files = files.filter((file) => file.filename.startsWith(normalizedPath));
        this.log.debug(
          {
            path: normalizedPath,
            originalCount,
            filteredCount: files.length,
          },
          'Files filtered by path',
        );
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

      this.log.info(
        {
          base,
          head,
          filesCount: fileChanges.length,
          commitsCount: commits.length,
          status: comparison.data.status,
        },
        'Changed files retrieved successfully',
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
      this.log.error({ error: gitError, base, head }, 'Failed to get changed files');
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
    this.log.debug('Getting most recent tag from repository');

    try {
      const { owner, repo } = this.github.getRepository();

      const tags = await this.github.executeWithRetry('listTags', (octokit) =>
        octokit.rest.repos.listTags({
          owner,
          repo,
          per_page: 1,
        }),
      );

      if (tags.data.length === 0) {
        this.log.info('No tags found in repository');
        return ok(null);
      }

      const lastTag: GitTag = {
        name: tags.data[0].name,
        sha: tags.data[0].commit.sha,
      };

      this.log.info(
        {
          tagName: lastTag.name,
          sha: lastTag.sha,
        },
        'Retrieved last tag',
      );

      return ok(lastTag);
    } catch (error) {
      const gitError = new GitOperationError('getLastTag', 'Failed to get last tag', error);
      this.log.error({ error: gitError }, 'Failed to get last tag');
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
    this.log.debug(
      {
        base,
        head,
      },
      'Getting commits between references',
    );

    try {
      const comparison = await this.getChangedFiles(base, head);

      if (!comparison.ok) {
        this.log.debug(
          {
            base,
            head,
            error: comparison.error,
          },
          'Failed to get comparison for commits',
        );
        return err(comparison.error);
      }

      this.log.info(
        {
          base,
          head,
          count: comparison.value.commits.length,
        },
        'Retrieved commits successfully',
      );

      return ok(comparison.value.commits);
    } catch (error) {
      const gitError = new GitOperationError('getCommitsSince', `Failed to get commits since ${base}`, error);
      this.log.error({ error: gitError, base, head }, 'Failed to get commits');
      return err(gitError);
    }
  }
}
