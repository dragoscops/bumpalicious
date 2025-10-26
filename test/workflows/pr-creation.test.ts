/**
 * PR Creation Workflow Integration Tests
 *
 * Tests PR creation functionality with GitHub service integration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GitHubService } from '../../src/services/GitHubService.js';
import { PRService } from '../../src/services/PRService.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

describe('PR Creation Workflow Integration', () => {
  let prService: PRService;
  let mockGitHubService: {
    getRepository: () => { owner: string; repo: string };
    executeWithRetry: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Create mock GitHub service with executeWithRetry
    mockGitHubService = {
      getRepository: () => ({ owner: 'test-owner', repo: 'test-repo' }),
      executeWithRetry: vi.fn(),
    };

    prService = new PRService(mockGitHubService as unknown as GitHubService);
  });

  describe('PR Creation', () => {
    it('should create PR successfully', async () => {
      mockGitHubService.executeWithRetry.mockResolvedValueOnce({
        data: { number: 123, html_url: 'https://github.com/test/repo/pull/123', state: 'open' },
      });

      const result = await prService.create({
        title: 'chore: bump version to 1.1.0',
        body: 'Automated version bump',
        head: 'bump-version-1.1.0',
        base: 'main',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.number).toBe(123);
      }
    });

    it('should handle draft PRs', async () => {
      mockGitHubService.executeWithRetry.mockResolvedValueOnce({
        data: { number: 124, html_url: 'https://github.com/test/repo/pull/124', state: 'open' },
      });

      const result = await prService.create({
        title: 'draft: version bump',
        body: 'Draft PR',
        head: 'bump',
        base: 'main',
        draft: true,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('PR Merging', () => {
    it('should merge PR successfully', async () => {
      mockGitHubService.executeWithRetry.mockResolvedValueOnce({
        data: { sha: 'merged-sha', merged: true },
      });

      const result = await prService.merge({
        prNumber: 123,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.merged).toBe(true);
      }
    });

    it('should support different merge methods', async () => {
      mockGitHubService.executeWithRetry.mockResolvedValueOnce({
        data: { sha: 'merged-sha', merged: true },
      });

      const result = await prService.merge({
        prNumber: 123,
        mergeMethod: 'squash',
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('PR Status', () => {
    it('should check merge status', async () => {
      // Mock the executeWithRetry to return not merged on first call
      mockGitHubService.executeWithRetry.mockResolvedValue({
        data: { number: 123, state: 'open', merged: false },
      });

      const result = await prService.hasMerged({
        prNumber: 123,
        timeout: 1000,
        interval: 100,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
      expect(mockGitHubService.executeWithRetry).toHaveBeenCalledWith('getPullRequest', expect.any(Function));
    });
  });
});
