/**
 * Custom error hierarchy for type-safe error handling
 */

/**
 * Base error class for all Bumpalicious errors
 */
export abstract class BumpaliciousError extends Error {
  abstract readonly code: string;
  abstract readonly recoverable: boolean;

  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Returns a formatted error message with cause information
   */
  getFullMessage(): string {
    if (this.cause) {
      const causeMessage = this.cause instanceof Error ? this.cause.message : String(this.cause);
      return `${this.message} (caused by: ${causeMessage})`;
    }
    return this.message;
  }
}

/**
 * Git operation errors
 */
export class GitOperationError extends BumpaliciousError {
  readonly code = 'GIT_OPERATION_FAILED';
  readonly recoverable = false;

  constructor(operation: string, message: string, cause?: unknown) {
    super(`Git operation '${operation}' failed: ${message}`, cause);
  }
}

/**
 * Workspace detection errors
 */
export class WorkspaceDetectionError extends BumpaliciousError {
  readonly code = 'WORKSPACE_DETECTION_FAILED';
  readonly recoverable = false;

  constructor(workspace: string, message: string, cause?: unknown) {
    super(`Workspace detection failed for '${workspace}': ${message}`, cause);
  }
}

/**
 * Workspace validation errors (e.g., tree structure violations)
 */
export class WorkspaceValidationError extends BumpaliciousError {
  readonly code = 'WORKSPACE_VALIDATION_FAILED';
  readonly recoverable = false;

  constructor(message: string, cause?: unknown) {
    super(`Workspace validation failed: ${message}`, cause);
  }
}

/**
 * Invalid configuration errors
 */
export class InvalidConfigurationError extends BumpaliciousError {
  readonly code = 'INVALID_CONFIGURATION';
  readonly recoverable = false;

  constructor(parameter: string, message: string, cause?: unknown) {
    super(`Invalid configuration for '${parameter}': ${message}`, cause);
  }
}

/**
 * GitHub API errors
 */
export class GitHubAPIError extends BumpaliciousError {
  readonly code = 'GITHUB_API_FAILED';
  readonly recoverable = true; // Can retry

  constructor(
    operation: string,
    message: string,
    public readonly statusCode?: number,
    cause?: unknown,
  ) {
    super(`GitHub API operation '${operation}' failed: ${message}`, cause);
  }
}

/**
 * File operation errors
 */
export class FileOperationError extends BumpaliciousError {
  readonly code = 'FILE_OPERATION_FAILED';
  readonly recoverable = false;

  constructor(filePath: string, operation: string, message: string, cause?: unknown) {
    super(`File operation '${operation}' failed for '${filePath}': ${message}`, cause);
  }
}

/**
 * Version calculation errors
 */
export class VersionCalculationError extends BumpaliciousError {
  readonly code = 'VERSION_CALCULATION_FAILED';
  readonly recoverable = false;

  constructor(message: string, cause?: unknown) {
    super(`Version calculation failed: ${message}`, cause);
  }
}

/**
 * Type guard to check if an error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof BumpaliciousError) {
    return error.recoverable;
  }
  return false;
}

/**
 * Type guard to check if an error is a BumpaliciousError
 */
export function isBumpaliciousError(error: unknown): error is BumpaliciousError {
  return error instanceof BumpaliciousError;
}

/**
 * Extracts error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof BumpaliciousError) {
    return error.getFullMessage();
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Wraps an unknown error as a BumpaliciousError
 */
export function wrapError(error: unknown, context: string): BumpaliciousError {
  if (isBumpaliciousError(error)) {
    return error;
  }

  const message = getErrorMessage(error);
  return new GitOperationError('unknown', `${context}: ${message}`, error);
}
