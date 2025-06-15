import pino from 'pino';
import pinoPretty from 'pino-pretty';

/**
 * Logging utilities for consistent output formatting
 * @module utils/logging
 */

const stream = pinoPretty({colorize: true});
export const logger = pino(stream);

// export const logger = pino({
//   level: process.env.LOG_LEVEL || 'info',
//   transport: {
//     target: 'pino-pretty',
//     options: {
//       // destination: 1,
//       colorize: true,
//     },
//   },
// });
