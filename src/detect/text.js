/**
 * Text-based project version and name detection
 * @module detect/text
 */

import fs from 'fs-extra';
import path from 'path';
import {TEXT_VERSION_FILES} from '../core/constants.js';
import * as logging from '../utils/logging.js';

/**
 * Detect version from a text-based project
 * Looking for version or VERSION files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If version could not be detected
 */
export const detectVersion = async (projectPath) => {
  for (const versionFile of TEXT_VERSION_FILES) {
    const filePath = path.join(projectPath, versionFile);

    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8');
      return content.trim();
      
    }
  }
  
  logging.error(`No version file found in the project at ${projectPath}`);
};

/**
 * Detect name from a text-based project
 * Using directory name as project name
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected name (directory name)
 */
export const detectName = async (projectPath) => {
  return path.basename(path.normalize(projectPath));
};
