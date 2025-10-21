/**
 * Repository Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GitHubService } from './GitHubService.js';
import type { OctokitInstance } from './GitHubService.js';
import { RepositoryService } from './RepositoryService.js';
import { GitOperationError } from '../utils/errors.js';

describe('RepositoryService', () => {
  let mockGitHub: GitHubService;
  let mockOctokit: Partial<OctokitInstance>;
  let repositoryService: RepositoryService;

  beforeEach(() => {
    // Mock Octokit instance
    mockOctokit = {
      rest: {
        repos: {
          getContent: vi.fn(),
          createOrUpdateFileContents: vi.fn(),
          listCommits: vi.fn(),
        },
      },
    } as unknown as Partial<OctokitInstance>;

    // Mock GitHubService
    mockGitHub = {
      getRepository: vi.fn().mockReturnValue({ owner: 'test-owner', repo: 'test-repo' }),
      getOctokit: vi.fn().mockReturnValue(mockOctokit),
      executeWithRetry: vi.fn(async (operationName, operation) => {
        return operation(mockOctokit as OctokitInstance);
      }),
    } as unknown as GitHubService;

    repositoryService = new RepositoryService(mockGitHub);
  });

  describe('getFileContent', () => {
    it('should successfully retrieve file content', async () => {
      const fileContent = 'test content';
      const encodedContent = Buffer.from(fileContent).toString('base64');

      vi.mocked(mockOctokit.rest!.repos!.getContent).mockResolvedValue({
        data: {
          type: 'file',
          path: 'test.txt',
          content: encodedContent,
          sha: 'abc123',
          size: fileContent.length,
          encoding: 'base64',
          name: 'test.txt',
          url: 'https://api.github.com/repos/test-owner/test-repo/contents/test.txt',
          html_url: 'https://github.com/test-owner/test-repo/blob/main/test.txt',
          git_url: 'https://api.github.com/repos/test-owner/test-repo/git/blobs/abc123',
          download_url: 'https://raw.githubusercontent.com/test-owner/test-repo/main/test.txt',
          _links: {
            self: 'https://api.github.com/repos/test-owner/test-repo/contents/test.txt',
            git: 'https://api.github.com/repos/test-owner/test-repo/git/blobs/abc123',
            html: 'https://github.com/test-owner/test-repo/blob/main/test.txt',
          },
        },
      } as never);

      const result = await repositoryService.getFileContent({
        path: 'test.txt',
        ref: 'main',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.path).toBe('test.txt');
        expect(result.value.content).toBe(fileContent);
        expect(result.value.encoding).toBe('utf-8');
        expect(result.value.sha).toBe('abc123');
        expect(result.value.size).toBe(fileContent.length);
      }

      expect(mockGitHub.executeWithRetry).toHaveBeenCalledWith('getContent', expect.any(Function));
    });

    it('should retrieve file content without ref parameter', async () => {
      const fileContent = '{"version":"1.0.0"}';
      const encodedContent = Buffer.from(fileContent).toString('base64');

      vi.mocked(mockOctokit.rest!.repos!.getContent).mockResolvedValue({
        data: {
          type: 'file',
          path: 'package.json',
          content: encodedContent,
          sha: 'def456',
          size: fileContent.length,
          encoding: 'base64',
          name: 'package.json',
          url: 'https://api.github.com/repos/test-owner/test-repo/contents/package.json',
          html_url: 'https://github.com/test-owner/test-repo/blob/main/package.json',
          git_url: 'https://api.github.com/repos/test-owner/test-repo/git/blobs/def456',
          download_url: 'https://raw.githubusercontent.com/test-owner/test-repo/main/package.json',
          _links: {
            self: 'https://api.github.com/repos/test-owner/test-repo/contents/package.json',
            git: 'https://api.github.com/repos/test-owner/test-repo/git/blobs/def456',
            html: 'https://github.com/test-owner/test-repo/blob/main/package.json',
          },
        },
      } as never);

      const result = await repositoryService.getFileContent({
        path: 'package.json',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.content).toBe(fileContent);
      }
    });

    it('should return error when path is not a file', async () => {
      vi.mocked(mockOctokit.rest!.repos!.getContent).mockResolvedValue({
        data: [
          {
            type: 'file',
            name: 'file1.txt',
            path: 'dir/file1.txt',
            sha: 'abc123',
            size: 100,
            url: 'https://api.github.com/repos/test-owner/test-repo/contents/dir/file1.txt',
            html_url: 'https://github.com/test-owner/test-repo/blob/main/dir/file1.txt',
            git_url: 'https://api.github.com/repos/test-owner/test-repo/git/blobs/abc123',
            download_url: 'https://raw.githubusercontent.com/test-owner/test-repo/main/dir/file1.txt',
            _links: {
              self: 'https://api.github.com/repos/test-owner/test-repo/contents/dir/file1.txt',
              git: 'https://api.github.com/repos/test-owner/test-repo/git/blobs/abc123',
              html: 'https://github.com/test-owner/test-repo/blob/main/dir/file1.txt',
            },
          },
        ],
      } as never);

      const result = await repositoryService.getFileContent({
        path: 'dir',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitOperationError);
        expect(result.error.message).toContain('not a file');
      }
    });

    it('should return error when API call fails', async () => {
      vi.mocked(mockOctokit.rest!.repos!.getContent).mockRejectedValue(new Error('Not found'));

      const result = await repositoryService.getFileContent({
        path: 'nonexistent.txt',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitOperationError);
        expect(result.error.message).toContain('getFileContent');
      }
    });
  });

  describe('updateFile', () => {
    it('should successfully update file content', async () => {
      vi.mocked(mockOctokit.rest!.repos!.createOrUpdateFileContents).mockResolvedValue({
        data: {
          content: {
            name: 'test.txt',
            path: 'test.txt',
            sha: 'new-sha-123',
            size: 100,
            url: 'https://api.github.com/repos/test-owner/test-repo/contents/test.txt',
            html_url: 'https://github.com/test-owner/test-repo/blob/main/test.txt',
            git_url: 'https://api.github.com/repos/test-owner/test-repo/git/blobs/new-sha-123',
            download_url: 'https://raw.githubusercontent.com/test-owner/test-repo/main/test.txt',
            type: 'file',
            _links: {
              self: 'https://api.github.com/repos/test-owner/test-repo/contents/test.txt',
              git: 'https://api.github.com/repos/test-owner/test-repo/git/blobs/new-sha-123',
              html: 'https://github.com/test-owner/test-repo/blob/main/test.txt',
            },
          },
          commit: {
            sha: 'commit-sha-456',
            node_id: 'C_abc123',
            url: 'https://api.github.com/repos/test-owner/test-repo/git/commits/commit-sha-456',
            html_url: 'https://github.com/test-owner/test-repo/commit/commit-sha-456',
            author: {
              name: 'Test User',
              email: 'test@example.com',
              date: '2025-10-19T00:00:00Z',
            },
            committer: {
              name: 'Test User',
              email: 'test@example.com',
              date: '2025-10-19T00:00:00Z',
            },
            tree: {
              sha: 'tree-sha',
              url: 'https://api.github.com/repos/test-owner/test-repo/git/trees/tree-sha',
            },
            message: 'Update test.txt',
            parents: [
              {
                sha: 'parent-sha',
                url: 'https://api.github.com/repos/test-owner/test-repo/git/commits/parent-sha',
                html_url: 'https://github.com/test-owner/test-repo/commit/parent-sha',
              },
            ],
            verification: {
              verified: false,
              reason: 'unsigned',
              signature: null,
              payload: null,
            },
          },
        },
      } as never);

      const result = await repositoryService.updateFile({
        path: 'test.txt',
        content: 'updated content',
        message: 'Update test.txt',
        sha: 'old-sha',
        branch: 'main',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sha).toBe('new-sha-123');
        expect(result.value.commit.sha).toBe('commit-sha-456');
        expect(result.value.commit.message).toBe('Update test.txt');
      }

      expect(mockGitHub.executeWithRetry).toHaveBeenCalledWith('updateFile', expect.any(Function));
    });

    it('should create new file without sha', async () => {
      vi.mocked(mockOctokit.rest!.repos!.createOrUpdateFileContents).mockResolvedValue({
        data: {
          content: {
            name: 'new.txt',
            path: 'new.txt',
            sha: 'new-file-sha',
            size: 50,
            url: 'https://api.github.com/repos/test-owner/test-repo/contents/new.txt',
            html_url: 'https://github.com/test-owner/test-repo/blob/main/new.txt',
            git_url: 'https://api.github.com/repos/test-owner/test-repo/git/blobs/new-file-sha',
            download_url: 'https://raw.githubusercontent.com/test-owner/test-repo/main/new.txt',
            type: 'file',
            _links: {
              self: 'https://api.github.com/repos/test-owner/test-repo/contents/new.txt',
              git: 'https://api.github.com/repos/test-owner/test-repo/git/blobs/new-file-sha',
              html: 'https://github.com/test-owner/test-repo/blob/main/new.txt',
            },
          },
          commit: {
            sha: 'new-commit-sha',
            node_id: 'C_def456',
            url: 'https://api.github.com/repos/test-owner/test-repo/git/commits/new-commit-sha',
            html_url: 'https://github.com/test-owner/test-repo/commit/new-commit-sha',
            author: {
              name: 'Test User',
              email: 'test@example.com',
              date: '2025-10-19T00:00:00Z',
            },
            committer: {
              name: 'Test User',
              email: 'test@example.com',
              date: '2025-10-19T00:00:00Z',
            },
            tree: {
              sha: 'tree-sha-2',
              url: 'https://api.github.com/repos/test-owner/test-repo/git/trees/tree-sha-2',
            },
            message: 'Create new.txt',
            parents: [],
            verification: {
              verified: false,
              reason: 'unsigned',
              signature: null,
              payload: null,
            },
          },
        },
      } as never);

      const result = await repositoryService.updateFile({
        path: 'new.txt',
        content: 'new content',
        message: 'Create new.txt',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sha).toBe('new-file-sha');
        expect(result.value.commit.sha).toBe('new-commit-sha');
      }
    });

    it('should return error when API call fails', async () => {
      vi.mocked(mockOctokit.rest!.repos!.createOrUpdateFileContents).mockRejectedValue(new Error('Permission denied'));

      const result = await repositoryService.updateFile({
        path: 'test.txt',
        content: 'content',
        message: 'Update test.txt',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitOperationError);
        expect(result.error.message).toContain('updateFile');
      }
    });
  });

  describe('getCommits', () => {
    it('should successfully retrieve commits', async () => {
      vi.mocked(mockOctokit.rest!.repos!.listCommits).mockResolvedValue({
        data: [
          {
            sha: 'commit1',
            node_id: 'C_1',
            commit: {
              message: 'feat: add feature',
              author: {
                name: 'Alice',
                email: 'alice@example.com',
                date: '2025-10-19T10:00:00Z',
              },
              committer: {
                name: 'Alice',
                email: 'alice@example.com',
                date: '2025-10-19T10:00:00Z',
              },
              tree: {
                sha: 'tree1',
                url: 'https://api.github.com/repos/test-owner/test-repo/git/trees/tree1',
              },
              url: 'https://api.github.com/repos/test-owner/test-repo/git/commits/commit1',
              verification: {
                verified: false,
                reason: 'unsigned',
                signature: null,
                payload: null,
              },
            },
            url: 'https://api.github.com/repos/test-owner/test-repo/commits/commit1',
            html_url: 'https://github.com/test-owner/test-repo/commit/commit1',
            comments_url: 'https://api.github.com/repos/test-owner/test-repo/commits/commit1/comments',
            author: null,
            committer: null,
            parents: [],
          },
          {
            sha: 'commit2',
            node_id: 'C_2',
            commit: {
              message: 'fix: bug fix',
              author: {
                name: 'Bob',
                email: 'bob@example.com',
                date: '2025-10-19T09:00:00Z',
              },
              committer: {
                name: 'Bob',
                email: 'bob@example.com',
                date: '2025-10-19T09:00:00Z',
              },
              tree: {
                sha: 'tree2',
                url: 'https://api.github.com/repos/test-owner/test-repo/git/trees/tree2',
              },
              url: 'https://api.github.com/repos/test-owner/test-repo/git/commits/commit2',
              verification: {
                verified: false,
                reason: 'unsigned',
                signature: null,
                payload: null,
              },
            },
            url: 'https://api.github.com/repos/test-owner/test-repo/commits/commit2',
            html_url: 'https://github.com/test-owner/test-repo/commit/commit2',
            comments_url: 'https://api.github.com/repos/test-owner/test-repo/commits/commit2/comments',
            author: null,
            committer: null,
            parents: [],
          },
        ],
      } as never);

      const result = await repositoryService.getCommits({
        sha: 'main',
        perPage: 30,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].sha).toBe('commit1');
        expect(result.value[0].message).toBe('feat: add feature');
        expect(result.value[0].author.name).toBe('Alice');
        expect(result.value[1].sha).toBe('commit2');
        expect(result.value[1].message).toBe('fix: bug fix');
      }

      expect(mockGitHub.executeWithRetry).toHaveBeenCalledWith('listCommits', expect.any(Function));
    });

    it('should retrieve commits with path filter', async () => {
      vi.mocked(mockOctokit.rest!.repos!.listCommits).mockResolvedValue({
        data: [
          {
            sha: 'commit1',
            node_id: 'C_1',
            commit: {
              message: 'Update package.json',
              author: {
                name: 'Test User',
                email: 'test@example.com',
                date: '2025-10-19T10:00:00Z',
              },
              committer: {
                name: 'Test User',
                email: 'test@example.com',
                date: '2025-10-19T10:00:00Z',
              },
              tree: {
                sha: 'tree1',
                url: 'https://api.github.com/repos/test-owner/test-repo/git/trees/tree1',
              },
              url: 'https://api.github.com/repos/test-owner/test-repo/git/commits/commit1',
              verification: {
                verified: false,
                reason: 'unsigned',
                signature: null,
                payload: null,
              },
            },
            url: 'https://api.github.com/repos/test-owner/test-repo/commits/commit1',
            html_url: 'https://github.com/test-owner/test-repo/commit/commit1',
            comments_url: 'https://api.github.com/repos/test-owner/test-repo/commits/commit1/comments',
            author: null,
            committer: null,
            parents: [],
          },
        ],
      } as never);

      const result = await repositoryService.getCommits({
        path: 'packages/api',
        perPage: 50,
        page: 1,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
      }
    });

    it('should retrieve commits without options', async () => {
      vi.mocked(mockOctokit.rest!.repos!.listCommits).mockResolvedValue({
        data: [],
      } as never);

      const result = await repositoryService.getCommits();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });

    it('should limit perPage to 100', async () => {
      vi.mocked(mockOctokit.rest!.repos!.listCommits).mockResolvedValue({
        data: [],
      } as never);

      await repositoryService.getCommits({
        perPage: 200, // Request more than max
      });

      expect(mockOctokit.rest!.repos!.listCommits).toHaveBeenCalledWith(
        expect.objectContaining({
          per_page: 100, // Should be capped at 100
        }),
      );
    });

    it('should return error when API call fails', async () => {
      vi.mocked(mockOctokit.rest!.repos!.listCommits).mockRejectedValue(new Error('Network error'));

      const result = await repositoryService.getCommits();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitOperationError);
        expect(result.error.message).toContain('getCommits');
      }
    });

    it('should handle commits with missing author information', async () => {
      vi.mocked(mockOctokit.rest!.repos!.listCommits).mockResolvedValue({
        data: [
          {
            sha: 'commit1',
            node_id: 'C_1',
            commit: {
              message: 'Commit without author',
              author: null,
              committer: {
                name: 'Committer',
                email: 'committer@example.com',
                date: '2025-10-19T10:00:00Z',
              },
              tree: {
                sha: 'tree1',
                url: 'https://api.github.com/repos/test-owner/test-repo/git/trees/tree1',
              },
              url: 'https://api.github.com/repos/test-owner/test-repo/git/commits/commit1',
              verification: {
                verified: false,
                reason: 'unsigned',
                signature: null,
                payload: null,
              },
            },
            url: 'https://api.github.com/repos/test-owner/test-repo/commits/commit1',
            html_url: 'https://github.com/test-owner/test-repo/commit/commit1',
            comments_url: 'https://api.github.com/repos/test-owner/test-repo/commits/commit1/comments',
            author: null,
            committer: null,
            parents: [],
          },
        ],
      } as never);

      const result = await repositoryService.getCommits();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value[0].author.name).toBe('Unknown');
        expect(result.value[0].author.email).toBe('unknown@example.com');
      }
    });
  });
});
