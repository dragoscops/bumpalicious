/**
 * Logging utilities with structured logging support using Pino
 */

import { pino } from 'pino';
import type { Logger, LoggerOptions } from 'pino';

/**
 * Log level from environment or default to 'info'
 * Respects GitHub Actions debug mode (ACTIONS_STEP_DEBUG=true)
 * Respects explicit LOG_LEVEL setting
 * Respects DEBUG environment variable for development
 */
const isGitHubActionsDebug = process.env.ACTIONS_STEP_DEBUG === 'true';
const isDebugMode = process.env.DEBUG === 'true' || isGitHubActionsDebug;
const LOG_LEVEL = process.env.LOG_LEVEL || (isGitHubActionsDebug ? 'debug' : 'info');

/**
 * Determine if running in development mode
 */
const isDevelopment = process.env.NODE_ENV === 'development' || isDebugMode;

/**
 * Pino logger configuration
 */
const loggerOptions: LoggerOptions = {
  level: LOG_LEVEL,
  // Use pretty printing in development, JSON in production
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
};

/**
 * Base logger instance
 */
export const logger: Logger = pino(loggerOptions);

/**
 * Creates a child logger with additional context
 * @param bindings - Context to add to all log messages
 * @returns Child logger instance
 */
export function createChildLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

/**
 * Masks sensitive data in log output
 * @param data - Object potentially containing sensitive data
 * @returns Object with sensitive fields masked
 */
export function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...data };
  const sensitiveKeys = ['token', 'password', 'secret', 'key', 'authorization', 'auth'];

  for (const key of Object.keys(masked)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      const value = masked[key];
      if (typeof value === 'string') {
        // Show first 4 and last 4 characters for tokens (if >= 8 chars)
        if (value.length >= 8) {
          masked[key] = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
        } else {
          masked[key] = '***REDACTED***';
        }
      } else {
        masked[key] = '***REDACTED***';
      }
    }
  }

  return masked;
}

/**
 * Formats error objects for logging
 * @param error - Error object to format
 * @returns Formatted error object
 */
export function formatError(error: Error | unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      ...(error as any), // Include custom enumerable properties
    };
  }

  return {
    message: String(error),
    type: typeof error,
  };
}

/**
 * Logs with automatic sensitive data masking
 * @param level - Log level
 * @param message - Log message
 * @param data - Additional data to log
 */
export function logSafe(
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
  message: string,
  data?: Record<string, unknown>,
): void {
  if (data) {
    const masked = maskSensitiveData(data);
    logger[level](masked, message);
  } else {
    logger[level](message);
  }
}

/**
 * Default export for convenience
 */
export default logger;
