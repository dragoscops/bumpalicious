/**
 * Tests for PRService
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { PRService } from './PRService.js';
import type { GitHubService, RepositoryContext } from './GitHubService.js';
import { GitHubAPIError } from '../utils/errors.js';
import type { WorkspaceTree, WorkspaceNode } from '../types/workspace.js';
import type { Version } from '../types/version.js';

describe('PRService', () => {
  let prService: PRService;
  let mockGitHub: {
    getRepository: Mock;
    executeWithRetry: Mock;
  };

  const mockRepository: RepositoryContext = {
    owner: 'test-owner',
    repo: 'test-repo',
  };

  beforeEach(() => {
    mockGitHub = {
      getRepository: vi.fn(() => mockRepository),
      executeWithRetry: vi.fn(),
    };

    prService = new PRService(mockGitHub as unknown as GitHubService);
  });

  describe('constructor', () => {
    it('creates PRService instance', () => {
      expect(prService).toBeInstanceOf(PRService);
    });
  });

  describe('create', () => {
    it('creates a pull request successfully', async () => {
      const mockPRResponse = {
        data: {
          number: 123,
          html_url: 'https://github.com/test-owner/test-repo/pull/123',
          state: 'open',
        },
      };

      mockGitHub.executeWithRetry.mockResolvedValueOnce(mockPRResponse);

      const result = await prService.create({
        title: 'Version Update 1.0.0',
        body: 'Test PR body',
        base: 'main',
        head: 'version_bump_v1.0.0',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.number).toBe(123);
        expect(result.value.htmlUrl).toBe('https://github.com/test-owner/test-repo/pull/123');
        expect(result.value.state).toBe('open');
      }

      expect(mockGitHub.executeWithRetry).toHaveBeenCalledWith('createPR', expect.any(Function));
    });

    it('creates a draft pull request', async () => {
      const mockPRResponse = {
        data: {
          number: 124,
          html_url: 'https://github.com/test-owner/test-repo/pull/124',
          state: 'open',
        },
      };

      mockGitHub.executeWithRetry.mockResolvedValueOnce(mockPRResponse);

      const result = await prService.create({
        title: 'Draft PR',
        body: 'Draft PR body',
        base: 'main',
        head: 'feature-branch',
        draft: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.number).toBe(124);
      }
    });

    it('returns error when PR creation fails', async () => {
      const mockError = new Error('API Error');
      mockGitHub.executeWithRetry.mockRejectedValueOnce(mockError);

      const result = await prService.create({
        title: 'Version Update',
        body: 'Test body',
        base: 'main',
        head: 'test-branch',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitHubAPIError);
        expect(result.error.message).toContain('Failed to create pull request');
      }
    });

    it('preserves GitHubAPIError when already wrapped', async () => {
      const apiError = new GitHubAPIError('createPR', 'Already wrapped', 403);
      mockGitHub.executeWithRetry.mockRejectedValueOnce(apiError);

      const result = await prService.create({
        title: 'Test',
        body: 'Body',
        base: 'main',
        head: 'test',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(apiError);
      }
    });
  });

  describe('merge', () => {
    it('merges a pull request successfully', async () => {
      const mockMergeResponse = {
        data: {
          merged: true,
          sha: 'abc123def456',
          message: 'Pull Request successfully merged',
        },
      };

      mockGitHub.executeWithRetry.mockResolvedValueOnce(mockMergeResponse);

      const result = await prService.merge({
        prNumber: 123,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.merged).toBe(true);
        expect(result.value.sha).toBe('abc123def456');
        expect(result.value.message).toBe('Pull Request successfully merged');
      }

      expect(mockGitHub.executeWithRetry).toHaveBeenCalledWith('mergePR', expect.any(Function));
    });

    it('merges with squash method', async () => {
      const mockMergeResponse = {
        data: {
          merged: true,
          sha: 'squash123',
          message: 'Squashed and merged',
        },
      };

      mockGitHub.executeWithRetry.mockResolvedValueOnce(mockMergeResponse);

      const result = await prService.merge({
        prNumber: 123,
        mergeMethod: 'squash',
        commitTitle: 'feat: new feature',
        commitMessage: 'Detailed commit message',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.merged).toBe(true);
        expect(result.value.sha).toBe('squash123');
      }
    });

    it('returns error when merge fails', async () => {
      const mockError = new Error('Merge conflict');
      mockGitHub.executeWithRetry.mockRejectedValueOnce(mockError);

      const result = await prService.merge({
        prNumber: 123,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitHubAPIError);
        expect(result.error.message).toContain('Failed to merge pull request');
      }
    });
  });

  describe('hasMerged', () => {
    it('returns true when PR is merged', async () => {
      const mockPRResponse = {
        data: {
          merged: true,
          merged_at: '2025-10-18T10:00:00Z',
          state: 'closed',
        },
      };

      mockGitHub.executeWithRetry.mockResolvedValueOnce(mockPRResponse);

      const result = await prService.hasMerged({
        prNumber: 123,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it('returns false when PR is closed but not merged', async () => {
      const mockPRResponse = {
        data: {
          merged: false,
          state: 'closed',
        },
      };

      mockGitHub.executeWithRetry.mockResolvedValueOnce(mockPRResponse);

      const result = await prService.hasMerged({
        prNumber: 123,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });

    it('polls until PR is merged', async () => {
      const mockPRResponseOpen = {
        data: {
          merged: false,
          state: 'open',
        },
      };

      const mockPRResponseMerged = {
        data: {
          merged: true,
          merged_at: '2025-10-18T10:00:00Z',
          state: 'closed',
        },
      };

      // First call: open, second call: merged
      mockGitHub.executeWithRetry.mockResolvedValueOnce(mockPRResponseOpen).mockResolvedValueOnce(mockPRResponseMerged);

      const result = await prService.hasMerged({
        prNumber: 123,
        timeout: 10000,
        interval: 100, // Short interval for testing
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }

      expect(mockGitHub.executeWithRetry).toHaveBeenCalledTimes(2);
    });

    it('returns false when timeout is reached', async () => {
      const mockPRResponse = {
        data: {
          merged: false,
          state: 'open',
        },
      };

      mockGitHub.executeWithRetry.mockResolvedValue(mockPRResponse);

      const result = await prService.hasMerged({
        prNumber: 123,
        timeout: 200, // Very short timeout
        interval: 100,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });

    it('returns error when API call fails', async () => {
      const mockError = new Error('API Error');
      mockGitHub.executeWithRetry.mockRejectedValueOnce(mockError);

      const result = await prService.hasMerged({
        prNumber: 123,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitHubAPIError);
        expect(result.error.message).toContain('Failed to check PR merge status');
      }
    });
  });

  describe('exists', () => {
    it('returns true when PR exists', async () => {
      const mockPRsResponse = {
        data: [
          {
            number: 123,
            state: 'open',
          },
        ],
      };

      mockGitHub.executeWithRetry.mockResolvedValueOnce(mockPRsResponse);

      const result = await prService.exists({
        base: 'main',
        head: 'version_bump_v1.0.0',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.exists).toBe(true);
        expect(result.value.number).toBe(123);
        expect(result.value.state).toBe('open');
      }

      expect(mockGitHub.executeWithRetry).toHaveBeenCalledWith('listPRs', expect.any(Function));
    });

    it('returns false when no PR exists', async () => {
      const mockPRsResponse = {
        data: [],
      };

      mockGitHub.executeWithRetry.mockResolvedValueOnce(mockPRsResponse);

      const result = await prService.exists({
        base: 'main',
        head: 'version_bump_v1.0.0',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.exists).toBe(false);
        expect(result.value.number).toBeUndefined();
        expect(result.value.state).toBeUndefined();
      }
    });

    it('returns first PR when multiple exist', async () => {
      const mockPRsResponse = {
        data: [
          {
            number: 123,
            state: 'open',
          },
          {
            number: 124,
            state: 'open',
          },
        ],
      };

      mockGitHub.executeWithRetry.mockResolvedValueOnce(mockPRsResponse);

      const result = await prService.exists({
        base: 'main',
        head: 'test-branch',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.exists).toBe(true);
        expect(result.value.number).toBe(123); // First PR
      }
    });

    it('returns error when API call fails', async () => {
      const mockError = new Error('API Error');
      mockGitHub.executeWithRetry.mockRejectedValueOnce(mockError);

      const result = await prService.exists({
        base: 'main',
        head: 'test-branch',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(GitHubAPIError);
        expect(result.error.message).toContain('Failed to check if PR exists');
      }
    });
  });

  describe('buildPRBody', () => {
    it('formats root workspace only', () => {
      const tree: WorkspaceTree = {
        root: {
          workspace: {
            path: '.',
            type: 'node',
            name: 'my-monorepo',
            version: '2.1.0' as Version,
            newVersion: '2.1.0' as Version,
            hasChanges: true,
            changedFiles: ['package.json'],
          },
          children: [],
          isRoot: true,
        },
        masterVersion: '2.1.0' as Version,
        allWorkspaces: [],
      };

      const body = PRService.buildPRBody(tree);

      expect(body).toContain('# Version Update: my-monorepo 2.1.0');
      expect(body).toContain('## 📦 Workspace Versions');
      expect(body).toContain('### 🏠 Root: my-monorepo');
      expect(body).toContain('**Version**: `2.1.0`');
      expect(body).toContain('**Path**: `.`');
      expect(body).toContain('**Type**: `node`');
      expect(body).not.toContain('### 📁 Child Workspaces');
    });

    it('formats workspace tree with children', () => {
      const tree: WorkspaceTree = {
        root: {
          workspace: {
            path: '.',
            type: 'node',
            name: 'my-monorepo',
            version: '2.1.0' as Version,
            newVersion: '2.1.0' as Version,
            hasChanges: true,
            changedFiles: [],
          },
          children: [
            {
              workspace: {
                path: 'packages/api',
                type: 'python',
                name: 'api-service',
                version: '1.5.0' as Version,
                newVersion: '1.5.0' as Version,
                hasChanges: true,
                changedFiles: ['setup.py'],
              },
              children: [],
              isRoot: false,
            },
            {
              workspace: {
                path: 'packages/ui',
                type: 'node',
                name: 'ui-components',
                version: '3.2.1' as Version,
                newVersion: '3.2.1' as Version,
                hasChanges: false,
                changedFiles: [],
              },
              children: [],
              isRoot: false,
            },
          ],
          isRoot: true,
        },
        masterVersion: '2.1.0' as Version,
        allWorkspaces: [],
      };

      const body = PRService.buildPRBody(tree);

      expect(body).toContain('### 📁 Child Workspaces');
      expect(body).toContain('- 🔄 **api-service** `1.5.0`');
      expect(body).toContain('- Path: `packages/api`');
      expect(body).toContain('- Type: `python`');
      expect(body).toContain('- ✓ **ui-components** `3.2.1`');
      expect(body).toContain('- Path: `packages/ui`');
      expect(body).toContain('- Type: `node`');
    });

    it('formats nested workspace hierarchy', () => {
      const tree: WorkspaceTree = {
        root: {
          workspace: {
            path: '.',
            type: 'node',
            name: 'root',
            version: '1.0.0' as Version,
            newVersion: '1.0.0' as Version,
            hasChanges: true,
            changedFiles: [],
          },
          children: [
            {
              workspace: {
                path: 'packages/parent',
                type: 'node',
                name: 'parent-workspace',
                version: '1.0.0' as Version,
                newVersion: '1.0.0' as Version,
                hasChanges: true,
                changedFiles: [],
              },
              children: [
                {
                  workspace: {
                    path: 'packages/parent/child',
                    type: 'node',
                    name: 'child-workspace',
                    version: '1.0.0' as Version,
                    newVersion: '1.0.0' as Version,
                    hasChanges: false,
                    changedFiles: [],
                  },
                  children: [],
                  isRoot: false,
                },
              ],
              isRoot: false,
            },
          ],
          isRoot: true,
        },
        masterVersion: '1.0.0' as Version,
        allWorkspaces: [],
      };

      const body = PRService.buildPRBody(tree);

      expect(body).toContain('- 🔄 **parent-workspace** `1.0.0`');
      expect(body).toContain('  - Path: `packages/parent`');
      expect(body).toContain('  - ✓ **child-workspace** `1.0.0`');
      expect(body).toContain('    - Path: `packages/parent/child`');
    });

    it('uses correct change indicators', () => {
      const tree: WorkspaceTree = {
        root: {
          workspace: {
            path: '.',
            type: 'node',
            name: 'root',
            version: '1.0.0' as Version,
            newVersion: '1.0.0' as Version,
            hasChanges: false,
            changedFiles: [],
          },
          children: [
            {
              workspace: {
                path: 'packages/changed',
                type: 'node',
                name: 'changed-workspace',
                version: '1.0.0' as Version,
                newVersion: '1.0.0' as Version,
                hasChanges: true,
                changedFiles: ['file.ts'],
              },
              children: [],
              isRoot: false,
            },
            {
              workspace: {
                path: 'packages/unchanged',
                type: 'node',
                name: 'unchanged-workspace',
                version: '1.0.0' as Version,
                newVersion: '1.0.0' as Version,
                hasChanges: false,
                changedFiles: [],
              },
              children: [],
              isRoot: false,
            },
          ],
          isRoot: true,
        },
        masterVersion: '1.0.0' as Version,
        allWorkspaces: [],
      };

      const body = PRService.buildPRBody(tree);

      expect(body).toContain('- 🔄 **changed-workspace**'); // 🔄 for hasChanges: true
      expect(body).toContain('- ✓ **unchanged-workspace**'); // ✓ for hasChanges: false
    });
  });

  describe('integration scenarios', () => {
    it('creates PR and checks existence', async () => {
      const mockPRResponse = {
        data: {
          number: 123,
          html_url: 'https://github.com/test-owner/test-repo/pull/123',
          state: 'open',
        },
      };

      const mockPRsResponse = {
        data: [
          {
            number: 123,
            state: 'open',
          },
        ],
      };

      mockGitHub.executeWithRetry.mockResolvedValueOnce(mockPRResponse).mockResolvedValueOnce(mockPRsResponse);

      // Create PR
      const createResult = await prService.create({
        title: 'Test PR',
        body: 'Test body',
        base: 'main',
        head: 'test-branch',
      });

      expect(createResult.ok).toBe(true);

      // Check if it exists
      const existsResult = await prService.exists({
        base: 'main',
        head: 'test-branch',
      });

      expect(existsResult.ok).toBe(true);
      if (existsResult.ok) {
        expect(existsResult.value.exists).toBe(true);
      }
    });

    it('merges PR and verifies merge status', async () => {
      const mockMergeResponse = {
        data: {
          merged: true,
          sha: 'abc123',
          message: 'Merged',
        },
      };

      const mockPRResponse = {
        data: {
          merged: true,
          merged_at: '2025-10-18T10:00:00Z',
          state: 'closed',
        },
      };

      mockGitHub.executeWithRetry.mockResolvedValueOnce(mockMergeResponse).mockResolvedValueOnce(mockPRResponse);

      // Merge PR
      const mergeResult = await prService.merge({
        prNumber: 123,
      });

      expect(mergeResult.ok).toBe(true);

      // Verify merged
      const hasMergedResult = await prService.hasMerged({
        prNumber: 123,
      });

      expect(hasMergedResult.ok).toBe(true);
      if (hasMergedResult.ok) {
        expect(hasMergedResult.value).toBe(true);
      }
    });
  });
});
