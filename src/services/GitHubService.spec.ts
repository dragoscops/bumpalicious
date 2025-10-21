/**
 * Tests for GitHub Service
 */

import * as actionsGithub from '@actions/github';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubService, type RepositoryContext } from './GitHubService.js';
import { GitHubAPIError } from '../utils/errors.js';

// Mock @actions/github
vi.mock('@actions/github', () => ({
  getOctokit: vi.fn(),
}));

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

describe('GitHubService', () => {
  let mockOctokit: GitHub;
  const testToken = 'ghp_test_token_1234567890';
  const testRepository: RepositoryContext = {
    owner: 'testuser',
    repo: 'testrepo',
  };

  beforeEach(() => {
    // Create mock Octokit instance
    mockOctokit = {
      rest: {
        repos: {
          get: vi.fn(),
          listTags: vi.fn(),
        },
        rateLimit: {
          get: vi.fn(),
        },
      },
    };

    // Mock getOctokit to return our mock
    vi.mocked(actionsGithub.getOctokit).mockReturnValue(mockOctokit as unknown as GitHub);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create service with token and repository', () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
      });

      expect(service).toBeDefined();
      expect(actionsGithub.getOctokit).toHaveBeenCalledWith(testToken);
    });

    it('should accept custom retry options', () => {
      const retryOptions = { maxAttempts: 5, initialDelayMs: 2000 };
      const service = new GitHubService(testToken, {
        repository: testRepository,
        retryOptions,
      });

      expect(service).toBeDefined();
    });

    it('should use default retry options if not provided', () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
      });

      expect(service).toBeDefined();
    });
  });

  describe('getOctokit', () => {
    it('should return Octokit instance', () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
      });

      const octokit = service.getOctokit();
      expect(octokit).toBe(mockOctokit);
    });
  });

  describe('getRepository', () => {
    it('should return repository context', () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
      });

      const repo = service.getRepository();
      expect(repo).toEqual(testRepository);
    });

    it('should return a copy of repository context', () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
      });

      const repo = service.getRepository();
      expect(repo).not.toBe(testRepository); // Different object
      expect(repo).toEqual(testRepository); // Same values
    });
  });

  describe('executeWithRetry', () => {
    it('should execute operation successfully', async () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
      });

      const mockData = { data: { id: 123, name: 'testrepo' } };
      mockOctokit.rest.repos.get.mockResolvedValue(mockData);

      const result = await service.executeWithRetry('getRepository', (octokit) =>
        octokit.rest.repos.get({ owner: testRepository.owner, repo: testRepository.repo }),
      );

      expect(result).toEqual(mockData);
      expect(mockOctokit.rest.repos.get).toHaveBeenCalledWith({
        owner: testRepository.owner,
        repo: testRepository.repo,
      });
    });

    it('should retry on transient failures', async () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
        retryOptions: { maxAttempts: 3, initialDelayMs: 10 },
      });

      const mockData = { data: { tags: [] } };
      mockOctokit.rest.repos.listTags
        .mockRejectedValueOnce({ status: 503, message: 'Service Unavailable' })
        .mockResolvedValueOnce(mockData);

      const result = await service.executeWithRetry('listTags', (octokit) =>
        octokit.rest.repos.listTags({ owner: testRepository.owner, repo: testRepository.repo }),
      );

      expect(result).toEqual(mockData);
      expect(mockOctokit.rest.repos.listTags).toHaveBeenCalledTimes(2);
    });

    it('should throw GitHubAPIError after max retries', async () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
        retryOptions: { maxAttempts: 2, initialDelayMs: 10 },
      });

      mockOctokit.rest.repos.get.mockRejectedValue({
        status: 503,
        message: 'Service Unavailable',
      });

      await expect(
        service.executeWithRetry('getRepository', (octokit) =>
          octokit.rest.repos.get({ owner: testRepository.owner, repo: testRepository.repo }),
        ),
      ).rejects.toThrow(GitHubAPIError);

      expect(mockOctokit.rest.repos.get).toHaveBeenCalledTimes(2);
    });

    it('should wrap errors with operation name', async () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
        retryOptions: { maxAttempts: 1 },
      });

      const errorMessage = 'Not Found';
      mockOctokit.rest.repos.get.mockRejectedValue({
        status: 404,
        message: errorMessage,
      });

      await expect(
        service.executeWithRetry('getRepository', (octokit) =>
          octokit.rest.repos.get({ owner: testRepository.owner, repo: testRepository.repo }),
        ),
      ).rejects.toThrow(GitHubAPIError);

      try {
        await service.executeWithRetry('getRepository', (octokit) =>
          octokit.rest.repos.get({ owner: testRepository.owner, repo: testRepository.repo }),
        );
      } catch (error) {
        expect(error).toBeInstanceOf(GitHubAPIError);
        expect((error as GitHubAPIError).statusCode).toBe(404);
      }
    });

    it('should handle non-Error objects', async () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
        retryOptions: { maxAttempts: 1 },
      });

      mockOctokit.rest.repos.get.mockRejectedValue('String error');

      await expect(
        service.executeWithRetry('getRepository', (octokit) =>
          octokit.rest.repos.get({ owner: testRepository.owner, repo: testRepository.repo }),
        ),
      ).rejects.toThrow(GitHubAPIError);
    });

    it('should pass through already wrapped GitHubAPIError', async () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
        retryOptions: { maxAttempts: 1 },
      });

      const originalError = new GitHubAPIError('testOp', 'Test error', 500);
      mockOctokit.rest.repos.get.mockRejectedValue(originalError);

      await expect(
        service.executeWithRetry('getRepository', (octokit) =>
          octokit.rest.repos.get({ owner: testRepository.owner, repo: testRepository.repo }),
        ),
      ).rejects.toThrow(originalError);
    });
  });

  describe('getRateLimit', () => {
    it('should fetch rate limit information', async () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
      });

      const mockRateLimit = {
        data: {
          rate: {
            limit: 5000,
            remaining: 4500,
            reset: 1234567890,
            used: 500,
          },
        },
      };
      mockOctokit.rest.rateLimit.get.mockResolvedValue(mockRateLimit);

      const rateLimit = await service.getRateLimit();

      expect(rateLimit).toEqual({
        limit: 5000,
        remaining: 4500,
        reset: 1234567890,
        used: 500,
      });
      expect(mockOctokit.rest.rateLimit.get).toHaveBeenCalled();
    });

    it('should throw GitHubAPIError on failure', async () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
      });

      mockOctokit.rest.rateLimit.get.mockRejectedValue({
        status: 403,
        message: 'Forbidden',
      });

      await expect(service.getRateLimit()).rejects.toThrow(GitHubAPIError);
    });
  });

  describe('checkRateLimit', () => {
    it('should return false if rate limit is sufficient', async () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
      });

      const mockRateLimit = {
        data: {
          rate: {
            limit: 5000,
            remaining: 4500,
            reset: Math.floor(Date.now() / 1000) + 3600,
            used: 500,
          },
        },
      };
      mockOctokit.rest.rateLimit.get.mockResolvedValue(mockRateLimit);

      const waited = await service.checkRateLimit(100);

      expect(waited).toBe(false);
    });

    it('should wait if rate limit below threshold', async () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
      });

      const resetTime = Math.floor(Date.now() / 1000) + 1; // Reset in 1 second
      const mockRateLimit = {
        data: {
          rate: {
            limit: 5000,
            remaining: 5,
            reset: resetTime,
            used: 4995,
          },
        },
      };
      mockOctokit.rest.rateLimit.get.mockResolvedValue(mockRateLimit);

      const startTime = Date.now();
      const waited = await service.checkRateLimit(10);
      const endTime = Date.now();

      expect(waited).toBe(true);
      // Should have waited approximately 1 second (with some tolerance)
      expect(endTime - startTime).toBeGreaterThanOrEqual(900);
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should not wait if reset time is in the past', async () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
      });

      const resetTime = Math.floor(Date.now() / 1000) - 60; // Reset 1 minute ago
      const mockRateLimit = {
        data: {
          rate: {
            limit: 5000,
            remaining: 5,
            reset: resetTime,
            used: 4995,
          },
        },
      };
      mockOctokit.rest.rateLimit.get.mockResolvedValue(mockRateLimit);

      const waited = await service.checkRateLimit(10);

      expect(waited).toBe(false);
    });

    it('should use custom threshold', async () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
      });

      const mockRateLimit = {
        data: {
          rate: {
            limit: 5000,
            remaining: 55,
            reset: Math.floor(Date.now() / 1000) + 3600,
            used: 4945,
          },
        },
      };
      mockOctokit.rest.rateLimit.get.mockResolvedValue(mockRateLimit);

      const waited = await service.checkRateLimit(50);

      expect(waited).toBe(false);
    });

    it('should handle rate limit check errors gracefully', async () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
      });

      mockOctokit.rest.rateLimit.get.mockRejectedValue(new Error('API Error'));

      // Should not throw, just return false
      const waited = await service.checkRateLimit();

      expect(waited).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow with rate limiting', async () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
      });

      const mockRateLimit = {
        data: {
          rate: {
            limit: 5000,
            remaining: 4500,
            reset: Math.floor(Date.now() / 1000) + 3600,
            used: 500,
          },
        },
      };
      const mockRepoData = { data: { id: 123, name: 'testrepo' } };

      mockOctokit.rest.rateLimit.get.mockResolvedValue(mockRateLimit);
      mockOctokit.rest.repos.get.mockResolvedValue(mockRepoData);

      // Check rate limit
      await service.checkRateLimit(100);

      // Execute operation
      const result = await service.executeWithRetry('getRepository', (octokit) =>
        octokit.rest.repos.get({ owner: testRepository.owner, repo: testRepository.repo }),
      );

      expect(result).toEqual(mockRepoData);
    });

    it('should retry after transient failure then succeed', async () => {
      const service = new GitHubService(testToken, {
        repository: testRepository,
        retryOptions: { maxAttempts: 3, initialDelayMs: 10 },
      });

      const mockData = { data: { tags: ['v1.0.0'] } };

      mockOctokit.rest.repos.listTags
        .mockRejectedValueOnce({ status: 500, message: 'Internal Server Error' })
        .mockRejectedValueOnce({ status: 503, message: 'Service Unavailable' })
        .mockResolvedValueOnce(mockData);

      const result = await service.executeWithRetry('listTags', (octokit) =>
        octokit.rest.repos.listTags({ owner: testRepository.owner, repo: testRepository.repo }),
      );

      expect(result).toEqual(mockData);
      expect(mockOctokit.rest.repos.listTags).toHaveBeenCalledTimes(3);
    });
  });
});
