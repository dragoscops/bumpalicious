/** Git operations wrapper using GitHub API */

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
import { Loggable } from '../utils/Loggable.js';

/** Git operations with tags, commits, refs, and file changes */
export class GitService extends Loggable {
  private readonly github: GitHubService;

  constructor(github: GitHubService) {
    super();
    this.github = github;
    this.log.info({ ...github.getRepository() }, 'GitService initialized');
  }

  // ====================
  // Refs & Tags
  // ====================

  /** Get commit SHA for reference */
  async getRef(ref: string): Promise<Result<GitRef, GitOperationError>> {
    this.log.debug({ ref }, 'Getting reference');

    try {
      const reference = await this.fetchRef(ref);
      this.log.info({ ref, ...reference.data.object }, 'Reference retrieved');
      return ok({ ref: reference.data.ref, sha: reference.data.object.sha });
    } catch (error) {
      return this.handleError('getRef', `Failed to get ref ${ref}`, error, { ref });
    }
  }

  /** Check if tag exists */
  async tagExists(tagName: string): Promise<Result<boolean, GitOperationError>> {
    this.log.debug({ tagName }, 'Checking tag existence');

    try {
      await this.fetchRef(`tags/${tagName}`);
      this.log.debug({ tagName }, 'Tag exists');
      return ok(true);
    } catch (error: unknown) {
      if (this.isNotFoundError(error)) {
        this.log.debug({ tagName }, 'Tag does not exist');
        return ok(false);
      }
      return this.handleError('tagExists', `Failed to check tag ${tagName}`, error, { tagName });
    }
  }

  /** Get most recent tag */
  async getLastTag(): Promise<Result<GitTag | null, GitOperationError>> {
    this.log.debug('Getting last tag');

    try {
      const tags = await this.fetchTags(1);

      if (tags.data.length === 0) {
        this.log.warn('No tags found');
        return ok(null);
      }

      const lastTag = { name: tags.data[0].name, sha: tags.data[0].commit.sha };
      this.log.info({ tagName: lastTag.name, sha: lastTag.sha }, 'Last tag retrieved');
      return ok(lastTag);
    } catch (error) {
      return this.handleError('getLastTag', 'Failed to get last tag', error);
    }
  }

  /** Create annotated tag */
  async createTag(params: CreateTagParams): Promise<Result<GitTag, GitOperationError>> {
    this.log.debug(
      { tagName: params.tagName, commitSha: params.commitSha, hasTagger: !!(params.taggerName && params.taggerEmail) },
      'Creating tag',
    );

    try {
      const tagObject = await this.createTagObject(params);
      await this.createTagRef(params.tagName, tagObject.data.sha);

      this.log.info({ tagName: params.tagName, sha: tagObject.data.sha, commitSha: params.commitSha }, 'Tag created');
      return ok({ name: params.tagName, sha: tagObject.data.sha, message: params.message });
    } catch (error) {
      return this.handleError('createTag', `Failed to create tag ${params.tagName}`, error, {
        tagName: params.tagName,
      });
    }
  }

  /** Delete tag */
  async deleteTag(tagName: string): Promise<Result<void, GitOperationError>> {
    this.log.debug({ tagName }, 'Deleting tag');

    try {
      await this.deleteRef(`tags/${tagName}`);
      this.log.info({ tagName }, 'Tag deleted');
      return ok(undefined);
    } catch (error) {
      return this.handleError('deleteTag', `Failed to delete tag ${tagName}`, error, { tagName });
    }
  }

  /** Update reference to new commit */
  async updateRef(params: UpdateRefParams): Promise<Result<GitRef, GitOperationError>> {
    this.log.debug({ ref: params.ref, sha: params.sha, force: params.force ?? false }, 'Updating reference');

    try {
      const { owner, repo } = this.github.getRepository();
      const reference = await this.github.executeWithRetry('updateRef', (octokit) =>
        octokit.rest.git.updateRef({ owner, repo, ref: params.ref, sha: params.sha, force: params.force ?? false }),
      );

      this.log.info({ ref: params.ref, sha: params.sha, updatedSha: reference.data.object.sha }, 'Reference updated');
      return ok({ ref: reference.data.ref, sha: reference.data.object.sha });
    } catch (error) {
      return this.handleError('updateRef', `Failed to update ref ${params.ref}`, error, { ref: params.ref });
    }
  }

  // ====================
  // Commits
  // ====================

  /** Get last commit in repository */
  async getLastCommit(branch?: string): Promise<Result<{ sha: string; message: string } | null, GitOperationError>> {
    this.log.debug({ branch }, 'Getting last commit');

    try {
      const commits = await this.fetchCommits(branch, 1);

      if (commits.data.length === 0) {
        this.log.info('No commits found');
        return ok(null);
      }

      const result = { sha: commits.data[0].sha, message: commits.data[0].commit.message };
      this.log.debug({ sha: result.sha, messageStart: result.message.substring(0, 50) }, 'Last commit retrieved');
      return ok(result);
    } catch (error) {
      return this.handleError('getLastCommit', 'Failed to get last commit', error);
    }
  }

  /** Get commits between two references */
  async getCommitsSince(base: string, head: string = 'HEAD'): Promise<Result<readonly GitCommit[], GitOperationError>> {
    this.log.debug({ base, head }, 'Getting commits between references');

    try {
      const comparison = await this.getChangedFiles(base, head);

      if (!comparison.ok) {
        this.log.debug({ base, head, error: comparison.error }, 'Failed to get comparison');
        return err(comparison.error);
      }

      this.log.info({ base, head, count: comparison.value.commits.length }, 'Commits retrieved');
      return ok(comparison.value.commits);
    } catch (error) {
      return this.handleError('getCommitsSince', `Failed to get commits since ${base}`, error, { base, head });
    }
  }

  /** Create commit */
  async createCommit(params: CreateCommitParams): Promise<Result<GitCommit, GitOperationError>> {
    this.log.debug(
      { message: params.message, tree: params.tree, parentsCount: params.parents.length, hasAuthor: !!params.author },
      'Creating commit',
    );

    try {
      const { owner, repo } = this.github.getRepository();
      const commit = await this.github.executeWithRetry('createCommit', (octokit) =>
        octokit.rest.git.createCommit({
          owner,
          repo,
          message: params.message,
          tree: params.tree,
          parents: [...params.parents],
          author: params.author ? { ...params.author, date: new Date().toISOString() } : undefined,
        }),
      );

      this.log.info(
        { sha: commit.data.sha, message: commit.data.message, author: commit.data.author.name },
        'Commit created',
      );

      return ok({
        sha: commit.data.sha,
        message: commit.data.message,
        author: { name: commit.data.author.name, email: commit.data.author.email },
        date: commit.data.author.date,
      });
    } catch (error) {
      return this.handleError('createCommit', 'Failed to create commit', error, { message: params.message });
    }
  }

  // ====================
  // File Changes
  // ====================

  /** Get changed files between two commits */
  async getChangedFiles(base: string, head: string, path?: string): Promise<Result<GitComparison, GitOperationError>> {
    this.log.debug({ base, head, path: path || 'all' }, 'Getting changed files');

    try {
      const { baseRef, headRef } = this.resolveRefs(base, head);
      const comparison = await this.compareCommits(baseRef, headRef);
      const files = this.filterFilesByPath(comparison.data.files || [], path);
      const fileChanges = this.mapFileChanges(files);
      const commits = this.mapCommits(comparison.data.commits || []);

      this.log.info(
        { base, head, filesCount: fileChanges.length, commitsCount: commits.length, status: comparison.data.status },
        'Changed files retrieved',
      );

      return ok({ base, head, files: fileChanges, commits });
    } catch (error) {
      return this.handleError('getChangedFiles', `Failed to get changed files between ${base} and ${head}`, error, {
        base,
        head,
      });
    }
  }

  // ====================
  // API Helpers
  // ====================

  /** Fetch git reference */
  private async fetchRef(ref: string) {
    const { owner, repo } = this.github.getRepository();
    return this.github.executeWithRetry('getRef', (octokit) => octokit.rest.git.getRef({ owner, repo, ref }));
  }

  /** Fetch tags with limit */
  private async fetchTags(perPage: number) {
    const { owner, repo } = this.github.getRepository();
    return this.github.executeWithRetry('listTags', (octokit) =>
      octokit.rest.repos.listTags({ owner, repo, per_page: perPage }),
    );
  }

  /** Fetch commits with optional branch and limit */
  private async fetchCommits(branch: string | undefined, perPage: number) {
    const { owner, repo } = this.github.getRepository();
    return this.github.executeWithRetry('listCommits', (octokit) =>
      octokit.rest.repos.listCommits({ owner, repo, sha: branch, per_page: perPage }),
    );
  }

  /** Create tag object */
  private async createTagObject(params: CreateTagParams) {
    const { owner, repo } = this.github.getRepository();
    this.log.debug({ tagName: params.tagName }, 'Creating tag object');

    return this.github.executeWithRetry('createTag', (octokit) =>
      octokit.rest.git.createTag({
        owner,
        repo,
        tag: params.tagName,
        message: params.message,
        object: params.commitSha,
        type: 'commit',
        tagger:
          params.taggerName && params.taggerEmail
            ? { name: params.taggerName, email: params.taggerEmail, date: new Date().toISOString() }
            : undefined,
      }),
    );
  }

  /** Create tag reference */
  private async createTagRef(tagName: string, sha: string) {
    const { owner, repo } = this.github.getRepository();
    this.log.debug({ tagName, tagSha: sha }, 'Creating tag reference');

    return this.github.executeWithRetry('createTagRef', (octokit) =>
      octokit.rest.git.createRef({ owner, repo, ref: `refs/tags/${tagName}`, sha }),
    );
  }

  /** Delete reference */
  private async deleteRef(ref: string) {
    const { owner, repo } = this.github.getRepository();
    return this.github.executeWithRetry('deleteRef', (octokit) => octokit.rest.git.deleteRef({ owner, repo, ref }));
  }

  /** Compare commits between refs */
  private async compareCommits(base: string, head: string) {
    const { owner, repo } = this.github.getRepository();
    const comparison = await this.github.executeWithRetry('compareCommits', (octokit) =>
      octokit.rest.repos.compareCommits({ owner, repo, base, head }),
    );

    this.log.debug(
      {
        base,
        head,
        status: comparison.data.status,
        aheadBy: comparison.data.ahead_by,
        behindBy: comparison.data.behind_by,
        totalCommits: comparison.data.total_commits,
        totalFiles: (comparison.data.files || []).length,
      },
      'Comparison received',
    );

    return comparison;
  }

  // ====================
  // Data Transformation
  // ====================

  /** Resolve base and head refs for comparison */
  private resolveRefs(base: string, head: string): { baseRef: string; headRef: string } {
    const baseRef = base.startsWith('v') && !base.startsWith('refs/') ? `refs/tags/${base}` : base;
    const needsHeadPrefix =
      !head.match(/^[0-9a-f]{40}$/i) && !head.startsWith('refs/') && !head.startsWith('v') && head !== 'HEAD';
    const headRef = needsHeadPrefix ? `refs/heads/${head}` : head;

    this.log.debug(
      {
        originalBase: base,
        resolvedBase: baseRef,
        originalHead: head,
        resolvedHead: headRef,
        addedHeadPrefix: needsHeadPrefix,
      },
      'Refs resolved',
    );

    return { baseRef, headRef };
  }

  /** Filter files by path prefix */
  private filterFilesByPath<T extends { filename: string }>(files: T[], path: string | undefined): T[] {
    if (!path) return files;

    const normalizedPath = path.endsWith('/') ? path : `${path}/`;
    const originalCount = files.length;
    const filtered = files.filter((file) => file.filename.startsWith(normalizedPath));

    this.log.debug({ path: normalizedPath, originalCount, filteredCount: filtered.length }, 'Files filtered');
    return filtered;
  }

  /** Map API file objects to FileChange */
  private mapFileChanges(
    files: Array<{ filename: string; status: string; additions: number; deletions: number }>,
  ): FileChange[] {
    return files.map((file) => ({
      path: file.filename,
      status: file.status as FileChange['status'],
      additions: file.additions,
      deletions: file.deletions,
    }));
  }

  /** Map API commit objects to GitCommit */
  private mapCommits(
    commits: Array<{
      sha: string;
      commit: { message: string; author?: { name?: string; email?: string; date?: string } | null };
    }>,
  ): GitCommit[] {
    return commits.map((commit) => ({
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

  /** Check if error is 404 Not Found */
  private isNotFoundError(error: unknown): boolean {
    return (error as { status?: number })?.status === 404;
  }

  /** Handle operation error with logging */
  private handleError<T>(
    operation: string,
    message: string,
    error: unknown,
    context?: Record<string, unknown>,
  ): Result<T, GitOperationError> {
    const gitError = new GitOperationError(operation, message, error);
    this.log.error({ error: gitError, ...context }, `${operation} failed`);
    return err(gitError);
  }
}
