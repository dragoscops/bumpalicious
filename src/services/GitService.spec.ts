/**
 * Tests for Git Operations Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GitHubService } from './GitHubService.js';
import { GitService } from './GitService.js';
import type { CreateTagParams, CreateCommitParams, UpdateRefParams } from '../types/git.js';
import { GitOperationError } from '../utils/errors.js';

// Mock logger to avoid noise in tests
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
    })),
  },
}));

describe('GitService', () => {
  let mockGitHub: GitHubService;
  let gitService: GitService;

  beforeEach(() => {
    // Create mock GitHub service
    mockGitHub = {
      getRepository: vi.fn().mockReturnValue({ owner: 'testowner', repo: 'testrepo' }),
      executeWithRetry: vi.fn(),
    } as unknown as GitHubService;

    gitService = new GitService(mockGitHub);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create service with GitHub service instance', () => {
      expect(gitService).toBeDefined();
    });
  });

  describe('createTag', () => {
    const tagParams: CreateTagParams = {
      tagName: 'v1.0.0',
      message: 'Release 1.0.0',
      commitSha: 'abc123def456',
      taggerName: 'Test Bot',
      taggerEmail: 'bot@example.com',
    };

    it('should create tag object and reference', async () => {
      const mockTagResponse = {
        data: {
          sha: 'tag-sha-123',
          tag: 'v1.0.0',
          message: 'Release 1.0.0',
        },
      };

      const mockRefResponse = {
        data: {
          ref: 'refs/tags/v1.0.0',
          object: { sha: 'tag-sha-123' },
        },
      };

      vi.mocked(mockGitHub.executeWithRetry)
        .mockResolvedValueOnce(mockTagResponse) // createTag
        .mockResolvedValueOnce(mockRefResponse); // createRef

      const result = await gitService.createTag(tagParams);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('v1.0.0');
        expect(result.value.sha).toBe('tag-sha-123');
        expect(result.value.message).toBe('Release 1.0.0');
      }

      expect(mockGitHub.executeWithRetry).toHaveBeenCalledTimes(2);
      expect(mockGitHub.executeWithRetry).toHaveBeenNthCalledWith(1, 'createTag', expect.any(Function));
      expect(mockGitHub.executeWithRetry).toHaveBeenNthCalledWith(2, 'createTagRef', expect.any(Function));
    });

    it('should create tag without tagger information', async () => {
      const paramsWithoutTagger: CreateTagParams = {
        tagName: 'v2.0.0',
        message: 'Release 2.0.0',
        commitSha: 'def456abc789',
      };

      const mockTagResponse = {
        data: {
          sha: 'tag-sha-456',
          tag: 'v2.0.0',
        },
      };

      const mockRefResponse = {
        data: {
          ref: 'refs/tags/v2.0.0',
          object: { sha: 'tag-sha-456' },
        },
      };

      vi.mocked(mockGitHub.executeWithRetry)
        .mockResolvedValueOnce(mockTagResponse)
        .mockResolvedValueOnce(mockRefResponse);

      const result = await gitService.createTag(paramsWithoutTagger);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('v2.0.0');
        expect(result.value.sha).toBe('tag-sha-456');
      }
    });

    it('should return error when tag creation fails', async () => {
      const error = new Error('API Error: Tag already exists');
      vi.mocked(mockGitHub.executeWithRetry).mockRejectedValueOnce(error);

      const result = await gitService.createTag(tagParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitOperationError);
        expect(result.error.code).toBe('GIT_OPERATION_FAILED');
        expect(result.error.message).toContain('v1.0.0');
      }
    });

    it('should return error when ref creation fails', async () => {
      const mockTagResponse = {
        data: {
          sha: 'tag-sha-123',
          tag: 'v1.0.0',
        },
      };

      const error = new Error('API Error: Reference already exists');
      vi.mocked(mockGitHub.executeWithRetry)
        .mockResolvedValueOnce(mockTagResponse) // Tag succeeds
        .mockRejectedValueOnce(error); // Ref fails

      const result = await gitService.createTag(tagParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitOperationError);
      }
    });
  });

  describe('createCommit', () => {
    const commitParams: CreateCommitParams = {
      message: 'chore: bump version to 1.0.0',
      tree: 'tree-sha-123',
      parents: ['parent-sha-456'],
      author: {
        name: 'Test Bot',
        email: 'bot@example.com',
      },
    };

    it('should create commit with author', async () => {
      const mockCommitResponse = {
        data: {
          sha: 'commit-sha-789',
          message: 'chore: bump version to 1.0.0',
          author: {
            name: 'Test Bot',
            email: 'bot@example.com',
            date: '2025-10-18T10:00:00Z',
          },
        },
      };

      vi.mocked(mockGitHub.executeWithRetry).mockResolvedValueOnce(mockCommitResponse);

      const result = await gitService.createCommit(commitParams);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sha).toBe('commit-sha-789');
        expect(result.value.message).toBe('chore: bump version to 1.0.0');
        expect(result.value.author.name).toBe('Test Bot');
        expect(result.value.author.email).toBe('bot@example.com');
      }

      expect(mockGitHub.executeWithRetry).toHaveBeenCalledWith('createCommit', expect.any(Function));
    });

    it('should create commit without author (uses default)', async () => {
      const paramsWithoutAuthor: CreateCommitParams = {
        message: 'fix: update dependencies',
        tree: 'tree-sha-999',
        parents: ['parent-sha-888'],
      };

      const mockCommitResponse = {
        data: {
          sha: 'commit-sha-111',
          message: 'fix: update dependencies',
          author: {
            name: 'GitHub Actions',
            email: 'actions@github.com',
            date: '2025-10-18T11:00:00Z',
          },
        },
      };

      vi.mocked(mockGitHub.executeWithRetry).mockResolvedValueOnce(mockCommitResponse);

      const result = await gitService.createCommit(paramsWithoutAuthor);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sha).toBe('commit-sha-111');
      }
    });

    it('should return error when commit creation fails', async () => {
      const error = new Error('API Error: Invalid tree SHA');
      vi.mocked(mockGitHub.executeWithRetry).mockRejectedValueOnce(error);

      const result = await gitService.createCommit(commitParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitOperationError);
        expect(result.error.code).toBe('GIT_OPERATION_FAILED');
      }
    });
  });

  describe('updateRef', () => {
    const refParams: UpdateRefParams = {
      ref: 'heads/main',
      sha: 'new-commit-sha-123',
      force: false,
    };

    it('should update reference', async () => {
      const mockRefResponse = {
        data: {
          ref: 'refs/heads/main',
          object: {
            sha: 'new-commit-sha-123',
          },
        },
      };

      vi.mocked(mockGitHub.executeWithRetry).mockResolvedValueOnce(mockRefResponse);

      const result = await gitService.updateRef(refParams);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.ref).toBe('refs/heads/main');
        expect(result.value.sha).toBe('new-commit-sha-123');
      }

      expect(mockGitHub.executeWithRetry).toHaveBeenCalledWith('updateRef', expect.any(Function));
    });

    it('should update reference with force flag', async () => {
      const forceParams: UpdateRefParams = {
        ref: 'heads/feature',
        sha: 'forced-sha-456',
        force: true,
      };

      const mockRefResponse = {
        data: {
          ref: 'refs/heads/feature',
          object: {
            sha: 'forced-sha-456',
          },
        },
      };

      vi.mocked(mockGitHub.executeWithRetry).mockResolvedValueOnce(mockRefResponse);

      const result = await gitService.updateRef(forceParams);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sha).toBe('forced-sha-456');
      }
    });

    it('should return error when ref update fails', async () => {
      const error = new Error('API Error: Reference not found');
      vi.mocked(mockGitHub.executeWithRetry).mockRejectedValueOnce(error);

      const result = await gitService.updateRef(refParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitOperationError);
        expect(result.error.message).toContain('heads/main');
      }
    });
  });

  describe('getChangedFiles', () => {
    it('should get changed files between commits', async () => {
      const mockComparisonResponse = {
        data: {
          files: [
            {
              filename: 'package.json',
              status: 'modified',
              additions: 5,
              deletions: 2,
            },
            {
              filename: 'src/index.ts',
              status: 'added',
              additions: 10,
              deletions: 0,
            },
          ],
          commits: [
            {
              sha: 'commit-123',
              commit: {
                message: 'feat: add new feature',
                author: {
                  name: 'Developer',
                  email: 'dev@example.com',
                  date: '2025-10-18T10:00:00Z',
                },
              },
            },
          ],
        },
      };

      vi.mocked(mockGitHub.executeWithRetry).mockResolvedValueOnce(mockComparisonResponse);

      const result = await gitService.getChangedFiles('v1.0.0', 'HEAD');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.base).toBe('v1.0.0');
        expect(result.value.head).toBe('HEAD');
        expect(result.value.files).toHaveLength(2);
        expect(result.value.files[0].path).toBe('package.json');
        expect(result.value.files[0].status).toBe('modified');
        expect(result.value.commits).toHaveLength(1);
        expect(result.value.commits[0].sha).toBe('commit-123');
      }
    });

    it('should filter files by path', async () => {
      const mockComparisonResponse = {
        data: {
          files: [
            {
              filename: 'packages/api/index.ts',
              status: 'modified',
              additions: 5,
              deletions: 1,
            },
            {
              filename: 'packages/web/app.ts',
              status: 'modified',
              additions: 3,
              deletions: 2,
            },
            {
              filename: 'README.md',
              status: 'modified',
              additions: 1,
              deletions: 0,
            },
          ],
          commits: [],
        },
      };

      vi.mocked(mockGitHub.executeWithRetry).mockResolvedValueOnce(mockComparisonResponse);

      const result = await gitService.getChangedFiles('v1.0.0', 'HEAD', 'packages/api');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.files).toHaveLength(1);
        expect(result.value.files[0].path).toBe('packages/api/index.ts');
      }
    });

    it('should handle no changed files', async () => {
      const mockComparisonResponse = {
        data: {
          files: [],
          commits: [],
        },
      };

      vi.mocked(mockGitHub.executeWithRetry).mockResolvedValueOnce(mockComparisonResponse);

      const result = await gitService.getChangedFiles('v1.0.0', 'v1.0.0');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.files).toHaveLength(0);
        expect(result.value.commits).toHaveLength(0);
      }
    });

    it('should return error when comparison fails', async () => {
      const error = new Error('API Error: Invalid commit reference');
      vi.mocked(mockGitHub.executeWithRetry).mockRejectedValueOnce(error);

      const result = await gitService.getChangedFiles('invalid', 'HEAD');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitOperationError);
        expect(result.error.message).toContain('invalid');
      }
    });
  });

  describe('getLastTag', () => {
    it('should return the most recent tag', async () => {
      const mockTagsResponse = {
        data: [
          {
            name: 'v2.0.0',
            commit: { sha: 'commit-sha-latest' },
          },
        ],
      };

      vi.mocked(mockGitHub.executeWithRetry).mockResolvedValueOnce(mockTagsResponse);

      const result = await gitService.getLastTag();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toBeNull();
        expect(result.value?.name).toBe('v2.0.0');
        expect(result.value?.sha).toBe('commit-sha-latest');
      }

      expect(mockGitHub.executeWithRetry).toHaveBeenCalledWith('listTags', expect.any(Function));
    });

    it('should return null when no tags exist', async () => {
      const mockTagsResponse = {
        data: [],
      };

      vi.mocked(mockGitHub.executeWithRetry).mockResolvedValueOnce(mockTagsResponse);

      const result = await gitService.getLastTag();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it('should return error when fetching tags fails', async () => {
      const error = new Error('API Error: Repository access denied');
      vi.mocked(mockGitHub.executeWithRetry).mockRejectedValueOnce(error);

      const result = await gitService.getLastTag();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitOperationError);
      }
    });
  });

  describe('getCommitsSince', () => {
    it('should get commits between base and head', async () => {
      const mockComparisonResponse = {
        data: {
          files: [],
          commits: [
            {
              sha: 'commit-123',
              commit: {
                message: 'feat: add feature',
                author: {
                  name: 'Dev 1',
                  email: 'dev1@example.com',
                  date: '2025-10-18T10:00:00Z',
                },
              },
            },
            {
              sha: 'commit-456',
              commit: {
                message: 'fix: bug fix',
                author: {
                  name: 'Dev 2',
                  email: 'dev2@example.com',
                  date: '2025-10-18T11:00:00Z',
                },
              },
            },
          ],
        },
      };

      vi.mocked(mockGitHub.executeWithRetry).mockResolvedValueOnce(mockComparisonResponse);

      const result = await gitService.getCommitsSince('v1.0.0', 'HEAD');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].sha).toBe('commit-123');
        expect(result.value[0].message).toBe('feat: add feature');
        expect(result.value[1].sha).toBe('commit-456');
      }
    });

    it('should use HEAD as default head parameter', async () => {
      const mockComparisonResponse = {
        data: {
          files: [],
          commits: [
            {
              sha: 'commit-789',
              commit: {
                message: 'chore: update',
                author: {
                  name: 'Bot',
                  email: 'bot@example.com',
                  date: '2025-10-18T12:00:00Z',
                },
              },
            },
          ],
        },
      };

      vi.mocked(mockGitHub.executeWithRetry).mockResolvedValueOnce(mockComparisonResponse);

      const result = await gitService.getCommitsSince('v1.0.0');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
      }
    });

    it('should return error when getting commits fails', async () => {
      const error = new Error('API Error: Invalid base reference');
      vi.mocked(mockGitHub.executeWithRetry).mockRejectedValueOnce(error);

      const result = await gitService.getCommitsSince('invalid-ref');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitOperationError);
      }
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete tag creation workflow', async () => {
      const mockTagResponse = {
        data: {
          sha: 'tag-object-sha',
          tag: 'v3.0.0',
        },
      };

      const mockRefResponse = {
        data: {
          ref: 'refs/tags/v3.0.0',
          object: { sha: 'tag-object-sha' },
        },
      };

      vi.mocked(mockGitHub.executeWithRetry)
        .mockResolvedValueOnce(mockTagResponse)
        .mockResolvedValueOnce(mockRefResponse);

      const result = await gitService.createTag({
        tagName: 'v3.0.0',
        message: 'Release 3.0.0\n\nBreaking changes included',
        commitSha: 'main-branch-sha',
        taggerName: 'Release Bot',
        taggerEmail: 'bot@company.com',
      });

      expect(result.ok).toBe(true);
      expect(mockGitHub.executeWithRetry).toHaveBeenCalledTimes(2);
    });

    it('should handle commit and ref update workflow', async () => {
      const mockCommitResponse = {
        data: {
          sha: 'new-commit-sha',
          message: 'chore: release v1.1.0',
          author: {
            name: 'Bot',
            email: 'bot@example.com',
            date: '2025-10-18T10:00:00Z',
          },
        },
      };

      const mockRefResponse = {
        data: {
          ref: 'refs/heads/main',
          object: { sha: 'new-commit-sha' },
        },
      };

      vi.mocked(mockGitHub.executeWithRetry)
        .mockResolvedValueOnce(mockCommitResponse)
        .mockResolvedValueOnce(mockRefResponse);

      const commitResult = await gitService.createCommit({
        message: 'chore: release v1.1.0',
        tree: 'tree-sha',
        parents: ['parent-sha'],
      });

      expect(commitResult.ok).toBe(true);

      if (commitResult.ok) {
        const refResult = await gitService.updateRef({
          ref: 'heads/main',
          sha: commitResult.value.sha,
        });

        expect(refResult.ok).toBe(true);
      }
    });
  });
});
