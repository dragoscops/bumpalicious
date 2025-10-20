/**
 * Tests for custom error classes
 */

import { describe, it, expect } from 'vitest';
import {
  BumpaliciousError,
  GitOperationError,
  WorkspaceDetectionError,
  WorkspaceValidationError,
  InvalidConfigurationError,
  GitHubAPIError,
  FileOperationError,
  VersionCalculationError,
  isRecoverableError,
  isBumpaliciousError,
  getErrorMessage,
  wrapError,
} from './errors.js';

describe('BumpaliciousError', () => {
  it('should create error with message', () => {
    const error = new GitOperationError('push', 'Failed to push');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(BumpaliciousError);
    expect(error.message).toContain('Failed to push');
  });

  it('should include cause in full message', () => {
    const cause = new Error('Network error');
    const error = new GitOperationError('push', 'Failed to push', cause);
    expect(error.getFullMessage()).toContain('caused by: Network error');
  });

  it('should capture stack trace', () => {
    const error = new GitOperationError('push', 'Failed to push');
    expect(error.stack).toBeDefined();
  });
});

describe('GitOperationError', () => {
  it('should have correct code and properties', () => {
    const error = new GitOperationError('tag', 'Tag already exists');
    expect(error.code).toBe('GIT_OPERATION_FAILED');
    expect(error.recoverable).toBe(false);
    expect(error.message).toContain("operation 'tag' failed");
  });
});

describe('WorkspaceDetectionError', () => {
  it('should include workspace path in message', () => {
    const error = new WorkspaceDetectionError('./packages/api', 'No version file found');
    expect(error.code).toBe('WORKSPACE_DETECTION_FAILED');
    expect(error.message).toContain('./packages/api');
    expect(error.message).toContain('No version file found');
  });
});

describe('WorkspaceValidationError', () => {
  it('should format validation errors', () => {
    const error = new WorkspaceValidationError('Multiple root workspaces detected');
    expect(error.code).toBe('WORKSPACE_VALIDATION_FAILED');
    expect(error.message).toContain('validation failed');
  });
});

describe('InvalidConfigurationError', () => {
  it('should include parameter name', () => {
    const error = new InvalidConfigurationError('workspaces', 'Invalid format');
    expect(error.code).toBe('INVALID_CONFIGURATION');
    expect(error.message).toContain('workspaces');
  });
});

describe('GitHubAPIError', () => {
  it('should be recoverable', () => {
    const error = new GitHubAPIError('createPR', 'Rate limit exceeded', 429);
    expect(error.code).toBe('GITHUB_API_FAILED');
    expect(error.recoverable).toBe(true);
    expect(error.statusCode).toBe(429);
  });
});

describe('FileOperationError', () => {
  it('should include file path and operation', () => {
    const error = new FileOperationError('/path/to/file.json', 'write', 'Permission denied');
    expect(error.code).toBe('FILE_OPERATION_FAILED');
    expect(error.message).toContain('/path/to/file.json');
    expect(error.message).toContain('write');
  });
});

describe('VersionCalculationError', () => {
  it('should format version errors', () => {
    const error = new VersionCalculationError('Invalid semver format');
    expect(error.code).toBe('VERSION_CALCULATION_FAILED');
    expect(error.message).toContain('Invalid semver format');
  });
});

describe('isRecoverableError', () => {
  it('should return true for recoverable errors', () => {
    const error = new GitHubAPIError('test', 'error');
    expect(isRecoverableError(error)).toBe(true);
  });

  it('should return false for non-recoverable errors', () => {
    const error = new GitOperationError('test', 'error');
    expect(isRecoverableError(error)).toBe(false);
  });

  it('should return false for non-Bumpalicious errors', () => {
    const error = new Error('generic error');
    expect(isRecoverableError(error)).toBe(false);
  });
});

describe('isBumpaliciousError', () => {
  it('should return true for Bumpalicious errors', () => {
    const error = new GitOperationError('test', 'error');
    expect(isBumpaliciousError(error)).toBe(true);
  });

  it('should return false for generic errors', () => {
    const error = new Error('generic error');
    expect(isBumpaliciousError(error)).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('should extract message from BumpaliciousError', () => {
    const cause = new Error('root cause');
    const error = new GitOperationError('test', 'error', cause);
    const message = getErrorMessage(error);
    expect(message).toContain('error');
    expect(message).toContain('root cause');
  });

  it('should extract message from Error', () => {
    const error = new Error('test error');
    expect(getErrorMessage(error)).toBe('test error');
  });

  it('should convert unknown types to string', () => {
    expect(getErrorMessage('string error')).toBe('string error');
    expect(getErrorMessage(42)).toBe('42');
  });
});

describe('wrapError', () => {
  it('should return BumpaliciousError unchanged', () => {
    const original = new GitOperationError('test', 'error');
    const wrapped = wrapError(original, 'context');
    expect(wrapped).toBe(original);
  });

  it('should wrap generic errors', () => {
    const original = new Error('generic error');
    const wrapped = wrapError(original, 'during operation');
    expect(wrapped).toBeInstanceOf(GitOperationError);
    expect(wrapped.message).toContain('during operation');
    expect(wrapped.message).toContain('generic error');
  });

  it('should wrap non-error values', () => {
    const wrapped = wrapError('string error', 'during operation');
    expect(wrapped).toBeInstanceOf(GitOperationError);
    expect(wrapped.message).toContain('string error');
  });
});
