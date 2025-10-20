/**
 * Tests for logger utility
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { logger, createChildLogger, maskSensitiveData, formatError, logSafe } from './logger.js';

describe('logger', () => {
  it('should be defined', () => {
    expect(logger).toBeDefined();
    expect(logger.info).toBeInstanceOf(Function);
  });

  it('should have all log level methods', () => {
    expect(logger.trace).toBeInstanceOf(Function);
    expect(logger.debug).toBeInstanceOf(Function);
    expect(logger.info).toBeInstanceOf(Function);
    expect(logger.warn).toBeInstanceOf(Function);
    expect(logger.error).toBeInstanceOf(Function);
    expect(logger.fatal).toBeInstanceOf(Function);
  });
});

describe('createChildLogger', () => {
  it('should create a child logger with bindings', () => {
    const child = createChildLogger({ module: 'test' });
    expect(child).toBeDefined();
    expect(child.info).toBeInstanceOf(Function);
  });

  it('should include bindings in child logger', () => {
    const child = createChildLogger({ requestId: '123', userId: 'user-456' });
    expect(child).toBeDefined();
    // Child logger should be instance of logger
    expect(typeof child.info).toBe('function');
  });
});

describe('maskSensitiveData', () => {
  it('should mask token fields', () => {
    const data = {
      token: 'ghp_1234567890abcdef',
      username: 'testuser',
    };

    const masked = maskSensitiveData(data);
    expect(masked.token).toBe('ghp_...cdef');
    expect(masked.username).toBe('testuser');
  });

  it('should mask password fields', () => {
    const data = {
      password: 'secret123456',
      email: 'test@example.com',
    };

    const masked = maskSensitiveData(data);
    expect(masked.password).toBe('secr...3456');
    expect(masked.email).toBe('test@example.com');
  });

  it('should mask authorization headers', () => {
    const data = {
      authorization: 'Bearer token123456789',
      'x-api-key': 'api_key_1234567890',
    };

    const masked = maskSensitiveData(data);
    expect(masked.authorization).toBe('Bear...6789');
    expect(masked['x-api-key']).toBe('api_...7890');
  });

  it('should mask short sensitive values completely', () => {
    const data = {
      secret: 'short',
      token: 'tiny',
    };

    const masked = maskSensitiveData(data);
    expect(masked.secret).toBe('***REDACTED***');
    expect(masked.token).toBe('***REDACTED***');
  });

  it('should mask non-string sensitive values', () => {
    const data = {
      apiKey: 12345,
      secret: { nested: 'object' },
    };

    const masked = maskSensitiveData(data);
    expect(masked.apiKey).toBe('***REDACTED***');
    expect(masked.secret).toBe('***REDACTED***');
  });

  it('should handle case-insensitive matching', () => {
    const data = {
      TOKEN: 'ghp_1234567890abcdef',
      Password: 'secret123456',
      AUTHORIZATION: 'Bearer token',
    };

    const masked = maskSensitiveData(data);
    expect(masked.TOKEN).toBe('ghp_...cdef');
    expect(masked.Password).toBe('secr...3456');
    expect(masked.AUTHORIZATION).toBe('Bear...oken');
  });

  it('should not modify non-sensitive data', () => {
    const data = {
      username: 'testuser',
      email: 'test@example.com',
      age: 30,
      active: true,
    };

    const masked = maskSensitiveData(data);
    expect(masked).toEqual(data);
  });
});

describe('formatError', () => {
  it('should format Error objects', () => {
    const error = new Error('Test error');
    error.name = 'TestError';

    const formatted = formatError(error);
    expect(formatted.message).toBe('Test error');
    expect(formatted.name).toBe('TestError');
    expect(formatted.stack).toBeDefined();
  });

  it('should include custom error properties', () => {
    const error = new Error('Test error') as any;
    error.code = 'ERR_TEST';
    error.statusCode = 500;

    const formatted = formatError(error);
    expect(formatted.message).toBe('Test error');
    expect(formatted.code).toBe('ERR_TEST');
    expect(formatted.statusCode).toBe(500);
  });

  it('should format non-Error values', () => {
    const formatted1 = formatError('string error');
    expect(formatted1.message).toBe('string error');
    expect(formatted1.type).toBe('string');

    const formatted2 = formatError(42);
    expect(formatted2.message).toBe('42');
    expect(formatted2.type).toBe('number');
  });

  it('should format null and undefined', () => {
    const formatted1 = formatError(null);
    expect(formatted1.message).toBe('null');
    expect(formatted1.type).toBe('object');

    const formatted2 = formatError(undefined);
    expect(formatted2.message).toBe('undefined');
    expect(formatted2.type).toBe('undefined');
  });
});

describe('logSafe', () => {
  beforeEach(() => {
    // Spy on logger methods
    vi.spyOn(logger, 'info').mockImplementation(() => undefined as any);
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined as any);
    vi.spyOn(logger, 'error').mockImplementation(() => undefined as any);
    vi.spyOn(logger, 'debug').mockImplementation(() => undefined as any);
    vi.spyOn(logger, 'trace').mockImplementation(() => undefined as any);
    vi.spyOn(logger, 'fatal').mockImplementation(() => undefined as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log info level messages', () => {
    logSafe('info', 'Test message');
    expect(logger.info).toHaveBeenCalledWith('Test message');
  });

  it('should log with data', () => {
    logSafe('info', 'Test message', { user: 'test' });
    expect(logger.info).toHaveBeenCalledWith({ user: 'test' }, 'Test message');
  });

  it('should mask sensitive data when logging', () => {
    logSafe('info', 'Login attempt', {
      username: 'testuser',
      password: 'secret123456',
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'testuser',
        password: 'secr...3456',
      }),
      'Login attempt',
    );
  });

  it('should support all log levels', () => {
    logSafe('trace', 'Trace message');
    expect(logger.trace).toHaveBeenCalledWith('Trace message');

    logSafe('debug', 'Debug message');
    expect(logger.debug).toHaveBeenCalledWith('Debug message');

    logSafe('warn', 'Warning message');
    expect(logger.warn).toHaveBeenCalledWith('Warning message');

    logSafe('error', 'Error message');
    expect(logger.error).toHaveBeenCalledWith('Error message');

    logSafe('fatal', 'Fatal message');
    expect(logger.fatal).toHaveBeenCalledWith('Fatal message');
  });

  it('should mask tokens in logged data', () => {
    logSafe('info', 'API call', {
      url: 'https://api.example.com',
      token: 'ghp_1234567890abcdef',
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.example.com',
        token: 'ghp_...cdef',
      }),
      'API call',
    );
  });
});
