import pino from 'pino';

/**
 * Logging utilities for consistent output formatting
 * @module utils/logging
 */

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      destination: 1,
      colorize: true,
    },
  },
});
