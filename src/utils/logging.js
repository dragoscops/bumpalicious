import pino from 'pino';
import pinoPretty from 'pino-pretty';

/**
 * Logging utilities for consistent output formatting
 * @module utils/logging
 */

const stream = pinoPretty({colorize: true});
export const logger = pino(stream);

/**
 * @param {Error} error - The error object to convert
 * @returns {Object} - An object loggable by pino
 */
export function pinoErrorPrettier(error) {
  return {
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack,
      ...error, // in case there are custom enumerable properties
    },
  };
}
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
