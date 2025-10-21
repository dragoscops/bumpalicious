import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BumpaliciousError, GitHubAPIError, WorkspaceValidationError } from './errors.js';
import { logger } from './logger.js';
import { retry } from './retry.js';

// Mock logger to prevent console output during tests
vi.mock('./logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('successful operations', () => {
    it('should return result immediately on successful operation', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const promise = retry(operation);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(logger.debug).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should return complex objects', async () => {
      const mockData = { id: 123, name: 'test', nested: { value: true } };
      const operation = vi.fn().mockResolvedValue(mockData);

      const promise = retry(operation);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(mockData);
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry logic', () => {
    it('should retry on recoverable errors and eventually succeed', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new GitHubAPIError('fetch', 'Timeout'))
        .mockRejectedValueOnce(new GitHubAPIError('fetch', 'Connection reset'))
        .mockResolvedValue('success');

      const promise = retry(operation, { maxAttempts: 3 });

      // First attempt fails
      await vi.runAllTimersAsync();
      // Second attempt fails
      await vi.runAllTimersAsync();
      // Third attempt succeeds
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
      // 2 retries = 2 "failed, retrying in" logs + 2 "Retry attempt" logs = 4 debug calls
      expect(logger.debug).toHaveBeenCalledTimes(4);
    });

    it('should not retry on non-recoverable errors', async () => {
      const validationError = new WorkspaceValidationError('Invalid input');
      const operation = vi.fn().mockRejectedValue(validationError);

      const promise = retry(operation);

      /* eslint-disable-next-line */
      const expectation = expect(promise).rejects.toThrow(WorkspaceValidationError);

      await vi.runAllTimersAsync();
      await expectation;

      expect(operation).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Invalid input') }),
        expect.stringContaining('non-retryable error'),
      );
    });

    it('should throw after max attempts with recoverable error', async () => {
      const networkError = new GitHubAPIError('fetch', 'Persistent failure');
      const operation = vi.fn().mockRejectedValue(networkError);

      const promise = retry(operation, { maxAttempts: 3 });

      /* eslint-disable-next-line */
      const expectation = expect(promise).rejects.toThrow(GitHubAPIError);

      await vi.runAllTimersAsync();
      await expectation;

      expect(operation).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Persistent failure') }),
        expect.stringContaining('failed after 3 attempts'),
      );
    });
  });

  describe('backoff strategy', () => {
    it('should use exponential backoff', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new GitHubAPIError('fetch', 'Error 1'))
        .mockRejectedValueOnce(new GitHubAPIError('fetch', 'Error 2'))
        .mockResolvedValue('success');

      const promise = retry(operation, {
        initialDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 10000,
        jitter: false,
      });

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(operation).toHaveBeenCalledTimes(1);

      // Wait for first backoff (1000ms)
      await vi.advanceTimersByTimeAsync(1000);
      expect(operation).toHaveBeenCalledTimes(2);

      // Wait for second backoff (2000ms = 1000 * 2^1)
      await vi.advanceTimersByTimeAsync(2000);
      expect(operation).toHaveBeenCalledTimes(3);

      await promise;
      expect(await promise).toBe('success');
    });

    it('should respect maxDelayMs cap', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new GitHubAPIError('fetch', 'Error 1'))
        .mockRejectedValueOnce(new GitHubAPIError('fetch', 'Error 2'))
        .mockResolvedValue('success');

      const promise = retry(operation, {
        initialDelayMs: 1000,
        backoffFactor: 10, // Very aggressive backoff
        maxDelayMs: 1500,
        jitter: false,
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(operation).toHaveBeenCalledTimes(1);

      // First retry: 1000ms (under max)
      await vi.advanceTimersByTimeAsync(1000);
      expect(operation).toHaveBeenCalledTimes(2);

      // Second retry: should be capped at 1500ms, not 10000ms
      await vi.advanceTimersByTimeAsync(1500);
      expect(operation).toHaveBeenCalledTimes(3);

      await promise;
    });

    it('should add jitter when enabled', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new GitHubAPIError('fetch', 'Error 1'))
        .mockResolvedValue('success');

      // Mock Math.random to return 0.5 for predictable jitter
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.5);

      const promise = retry(operation, {
        initialDelayMs: 1000,
        backoffFactor: 2,
        maxDelayMs: 10000,
        jitter: true,
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(operation).toHaveBeenCalledTimes(1);

      // With jitter=0.5, delay = 1000 + (0.5 * 1000) = 1500ms
      await vi.advanceTimersByTimeAsync(1500);
      expect(operation).toHaveBeenCalledTimes(2);

      await promise;

      Math.random = originalRandom;
    });

    it('should not add jitter when disabled', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new GitHubAPIError('fetch', 'Error 1'))
        .mockResolvedValue('success');

      const promise = retry(operation, {
        initialDelayMs: 1000,
        jitter: false,
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(operation).toHaveBeenCalledTimes(1);

      // Without jitter, delay is exactly 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      expect(operation).toHaveBeenCalledTimes(2);

      await promise;
    });
  });

  describe('custom shouldRetry', () => {
    it('should use custom shouldRetry function', async () => {
      const customError = new Error('Custom error');
      const operation = vi.fn().mockRejectedValue(customError);

      // Custom retry logic: only retry on specific message
      const shouldRetry = vi.fn((error: unknown) => {
        return error instanceof Error && error.message === 'Custom error';
      });

      const promise = retry(operation, {
        maxAttempts: 2,
        shouldRetry,
      });

      /* eslint-disable-next-line */
      const expectation = expect(promise).rejects.toThrow('Custom error');

      await vi.runAllTimersAsync();
      await expectation;

      expect(operation).toHaveBeenCalledTimes(2);
      expect(shouldRetry).toHaveBeenCalledTimes(2);
      expect(shouldRetry).toHaveBeenCalledWith(customError);
    });

    it('should not retry when custom shouldRetry returns false', async () => {
      const error = new GitHubAPIError('fetch', 'Network error');
      const operation = vi.fn().mockRejectedValue(error);

      // Custom retry logic that always returns false
      const shouldRetry = vi.fn(() => false);

      const promise = retry(operation, { shouldRetry });

      /* eslint-disable-next-line */
      const expectation = expect(promise).rejects.toThrow(GitHubAPIError);

      await vi.runAllTimersAsync();
      await expectation;

      expect(operation).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining('non-retryable error'));
    });
  });

  describe('operation naming', () => {
    it('should use default operation name in logs', async () => {
      const operation = vi.fn().mockRejectedValue(new GitHubAPIError('fetch', 'Error'));

      const promise = retry(operation, { maxAttempts: 1 });

      /* eslint-disable-next-line */
      const expectation = expect(promise).rejects.toThrow(GitHubAPIError);

      await vi.runAllTimersAsync();
      await expectation;

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Error') }),
        expect.stringContaining('operation failed after 1 attempts'),
      );
    });

    it('should use custom operation name in logs', async () => {
      const operation = vi.fn().mockRejectedValue(new GitHubAPIError('fetch', 'Error'));

      const promise = retry(operation, {
        maxAttempts: 1,
        operationName: 'FetchGitTags',
      });

      /* eslint-disable-next-line */
      const expectation = expect(promise).rejects.toThrow(GitHubAPIError);

      await vi.runAllTimersAsync();
      await expectation;

      expect(logger.warn).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('FetchGitTags failed after 1 attempts'),
      );
    });
  });

  describe('configuration options', () => {
    it('should use default options when none provided', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new GitHubAPIError('fetch', 'Error'))
        .mockResolvedValue('success');

      const promise = retry(operation);

      await vi.advanceTimersByTimeAsync(0);
      expect(operation).toHaveBeenCalledTimes(1);

      // Default initialDelayMs is 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      expect(operation).toHaveBeenCalledTimes(2);

      await promise;
      expect(await promise).toBe('success');
    });

    it('should allow maxAttempts of 1 (no retries)', async () => {
      const operation = vi.fn().mockRejectedValue(new GitHubAPIError('fetch', 'Error'));

      const promise = retry(operation, { maxAttempts: 1 });

      /* eslint-disable-next-line */
      const expectation = expect(promise).rejects.toThrow(GitHubAPIError);

      await vi.runAllTimersAsync();
      await expectation;

      expect(operation).toHaveBeenCalledTimes(1);
      expect(logger.debug).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining('failed after 1 attempts'));
    });

    it('should handle high maxAttempts values', async () => {
      const operation = vi.fn().mockRejectedValue(new GitHubAPIError('fetch', 'Error'));

      const promise = retry(operation, {
        maxAttempts: 10,
        initialDelayMs: 10,
        maxDelayMs: 100,
      });

      /* eslint-disable-next-line */
      const expectation = expect(promise).rejects.toThrow(GitHubAPIError);

      await vi.runAllTimersAsync();
      await expectation;

      expect(operation).toHaveBeenCalledTimes(10);
      expect(logger.warn).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining('failed after 10 attempts'));
    });
  });

  describe('error types', () => {
    it('should retry on BumpaliciousError with isRecoverable=true', async () => {
      class RecoverableCustomError extends BumpaliciousError {
        readonly code = 'RECOVERABLE_ERROR';
        readonly recoverable = true;

        constructor(message: string) {
          super(message);
        }
      }

      const operation = vi
        .fn()
        .mockRejectedValueOnce(new RecoverableCustomError('Recoverable'))
        .mockResolvedValue('success');

      const promise = retry(operation);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on standard Error', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Standard error'));

      const promise = retry(operation);

      /* eslint-disable-next-line */
      const expectation = expect(promise).rejects.toThrow('Standard error');

      await vi.runAllTimersAsync();
      await expectation;

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error rejections', async () => {
      const operation = vi.fn().mockRejectedValue('string error');

      const promise = retry(operation);

      /* eslint-disable-next-line */
      const expectation = expect(promise).rejects.toBe('string error');

      await vi.runAllTimersAsync();
      await expectation;

      expect(operation).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'string error' }),
        expect.stringContaining('non-retryable error'),
      );
    });
  });

  describe('logging', () => {
    it('should log retry attempts with context', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new GitHubAPIError('fetch', 'Timeout'))
        .mockResolvedValue('success');

      const promise = retry(operation, {
        maxAttempts: 3,
        operationName: 'TestOperation',
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(logger.debug).toHaveBeenCalledWith(
        {
          attempt: 1,
          maxAttempts: 3,
          error: expect.stringContaining('Timeout'),
        },
        expect.stringContaining('TestOperation failed, retrying in'),
      );
    });

    it('should log final failure with context', async () => {
      const operation = vi.fn().mockRejectedValue(new GitHubAPIError('fetch', 'Persistent'));

      const promise = retry(operation, {
        maxAttempts: 2,
        operationName: 'FailingOperation',
      });

      /* eslint-disable-next-line */
      const expectation = expect(promise).rejects.toThrow(GitHubAPIError);

      await vi.runAllTimersAsync();
      await expectation;

      expect(logger.warn).toHaveBeenCalledWith(
        { error: expect.stringContaining('Persistent') },
        'FailingOperation failed after 2 attempts',
      );
    });

    it('should log non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(new WorkspaceValidationError('Invalid'));

      const promise = retry(operation);

      /* eslint-disable-next-line */
      const expectation = expect(promise).rejects.toThrow(WorkspaceValidationError);

      await vi.runAllTimersAsync();
      await expectation;

      expect(logger.debug).toHaveBeenCalledWith(
        { error: expect.stringContaining('Invalid') },
        'operation failed with non-retryable error',
      );
    });
  });
});
