/**
 * Retry logic with exponential backoff for network operations
 */

import { logger } from './logger.js';
import { isRecoverableError } from './errors.js';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts (default: 3)
   */
  readonly maxAttempts?: number;

  /**
   * Initial delay in milliseconds (default: 1000)
   */
  readonly initialDelayMs?: number;

  /**
   * Maximum delay in milliseconds (default: 30000)
   */
  readonly maxDelayMs?: number;

  /**
   * Exponential backoff factor (default: 2)
   */
  readonly backoffFactor?: number;

  /**
   * Whether to add jitter to delay (default: true)
   */
  readonly jitter?: boolean;

  /**
   * Custom function to determine if error is retryable (default: isRecoverableError)
   */
  readonly shouldRetry?: (error: unknown) => boolean;

  /**
   * Operation name for logging (optional)
   */
  readonly operationName?: string;
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'operationName'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
  jitter: true,
  shouldRetry: isRecoverableError,
};

/**
 * Calculates the delay for the next retry attempt
 * @param attempt - Current attempt number (0-indexed)
 * @param options - Retry options
 * @returns Delay in milliseconds
 */
function calculateDelay(attempt: number, options: Required<Omit<RetryOptions, 'operationName'>>): number {
  // Exponential backoff: initialDelay * (backoffFactor ^ attempt)
  const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffFactor, attempt);

  // Cap at max delay
  let delay = Math.min(exponentialDelay, options.maxDelayMs);

  // Add jitter to prevent thundering herd
  if (options.jitter) {
    // Jitter: random value between 0 and delay
    delay = Math.random() * delay;
  }

  return Math.floor(delay);
}

/**
 * Delays execution for the specified duration
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries an operation with exponential backoff
 *
 * @template T - Return type of the operation
 * @param operation - Async function to retry
 * @param options - Retry configuration options
 * @returns Promise resolving to the operation result
 * @throws The last error if all retry attempts fail
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   async () => fetchData(),
 *   { maxAttempts: 3, operationName: 'fetchData' }
 * );
 * ```
 */
export async function retry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const operationName = options.operationName || 'operation';
  let lastError: unknown;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      if (attempt > 0) {
        logger.debug(`Retry attempt ${attempt + 1}/${config.maxAttempts} for ${operationName}`);
      }

      const result = await operation();

      if (attempt > 0) {
        logger.info(`${operationName} succeeded on attempt ${attempt + 1}`);
      }

      return result;
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const shouldRetry = config.shouldRetry(error);

      if (!shouldRetry) {
        logger.debug(
          { error: error instanceof Error ? error.message : String(error) },
          `${operationName} failed with non-retryable error`,
        );
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= config.maxAttempts - 1) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          `${operationName} failed after ${config.maxAttempts} attempts`,
        );
        break;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, config);
      logger.debug(
        {
          attempt: attempt + 1,
          maxAttempts: config.maxAttempts,
          error: error instanceof Error ? error.message : String(error),
        },
        `${operationName} failed, retrying in ${delay}ms`,
      );

      await sleep(delay);
    }
  }

  // All retries exhausted, throw the last error
  throw lastError;
}

/**
 * Creates a retry wrapper function with pre-configured options
 *
 * @param options - Default retry options for all operations
 * @returns Function that retries operations with the configured options
 *
 * @example
 * ```typescript
 * const retryWithDefaults = createRetryFunction({ maxAttempts: 5 });
 * const result = await retryWithDefaults(() => fetchData());
 * ```
 */
export function createRetryFunction(options: RetryOptions) {
  return <T>(operation: () => Promise<T>, overrides?: RetryOptions): Promise<T> => {
    return retry(operation, { ...options, ...overrides });
  };
}
