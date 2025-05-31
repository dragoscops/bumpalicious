import pino from 'pino';

/**
 * Logging utilities for consistent output formatting
 * @module utils/logging
 */

export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});
