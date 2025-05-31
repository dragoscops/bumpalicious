/**
 * Node.js built-in modules wrapper for easier testing and mocking
 * @module utils/node-wrapper
 */

import {promises as fsPromises, constants as fsConstants, createWriteStream} from 'fs';
import {pipeline} from 'stream';
import {promisify} from 'util';

/**
 * File system utilities with both sync and async methods
 */
export const fs = {
  // Async methods (promises)
  async: fsPromises,
  // Constants
  constants: fsConstants,
  // Stream methods
  createWriteStream,
};

/**
 * Stream utilities with promisified methods
 */
export const stream = {
  // Async pipeline
  async: {
    pipeline: promisify(pipeline),
  },
};
