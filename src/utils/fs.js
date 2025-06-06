/**
 * File system utilities
 */

import fs from 'fs/promises';
import {constants, createWriteStream} from 'fs';
import {pipeline} from 'stream/promises';

/**
 * Check if a file exists and is accessible
 * @param {string} filePath - File path to check
 * @returns {Promise<boolean>} - True if file exists, false otherwise
 */
export const fileExists = async (filePath) => {
  try {
    await fs.access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Create a pipeline from a stream to a file
 * @param {stream.Readable} changelogStream - Source stream
 * @param {string} outputPath - Output file path
 * @returns {Promise<void>} - Resolves when pipeline completes
 */
export const pipelineToFile = async (changelogStream, outputPath) =>
  pipeline(changelogStream, createWriteStream(outputPath));

/**
 * Read file content with error logging
 * @param {string} filePath - Path to the file to read
 * @param {string} [encoding='utf8'] - File encoding
 * @returns {Promise<string|null>} - File content as string
 */
export const readFile = async (filePath, encoding = 'utf8') => {
  try {
    await fs.access(filePath, constants.R_OK);
    return fs.readFile(filePath, encoding);
  } catch {
    return null;
  }
};

/**
 * Write content to file with error logging
 * @param {string} filePath - Path to the file to write
 * @param {string} content - Content to write
 * @param {string} [encoding='utf8'] - File encoding
 * @returns {Promise<void>} - Resolves when write completes
 */
export const writeFile = async (filePath, content, encoding = 'utf8') => {
  try {
    return await fs.writeFile(filePath, content, encoding);
  } catch {
    throw new Error('Failed to write file');
  }
};

/**
 * Delete a file
 * @param {string} path - Path to the file to delete
 * @returns {Promise<void>} - Resolves when file is deleted
 */
export const unlink = async (...args) => fs.unlink(...args);
