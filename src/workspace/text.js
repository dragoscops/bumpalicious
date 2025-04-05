/**
 * Text-based project version and name detection
 * @module detect/text
 */

import fs from 'fs-extra';
import path from 'path';
import {TEXT_VERSION_FILES} from '../core/constants.js';
import * as logging from '../utils/logging.js';

/**
 * @typedef {Object} TextConfig
 * @property {string} name - Project name
 * @property {string} version - Project version
 */

/**
 * Detect version from a text-based project
 * Looking for version or VERSION files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<TextConfig>} - Detected version
 */
export const detect = async (projectPath) => {
  for (const versionFile of TEXT_VERSION_FILES) {
    const filePath = path.join(projectPath, versionFile);

    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8');
      return {
        name: path.basename(path.normalize(projectPath)),
        version: content.trim(),
      };
    }
  }

  logging.error(`No version file found in the project at ${projectPath}`);
};

/**
 * Update version in a text-based project
 * Looking for version or VERSION files
 *
 * @param {Object} options - Update options
 * @param {string} options.projectPath - Path to the project
 * @param {string} options.newVersion - New version to set
 */
export const updateVersion = async ({projectPath, newVersion}) => {
  for (const versionFile of TEXT_VERSION_FILES) {
    const versionPath = path.join(projectPath, versionFile);
    if (await fs.pathExists(versionPath)) {
      try {
        await fs.readFile(versionPath, 'utf8');
        await fs.writeFile(versionPath, newVersion, 'utf8');
        break; // Only update the first version file we find
      } catch (error) {
        logging.error(`Error updating ${versionFile}:`, error);
      }
    }
  }

  logging.error(`No version file found in the project at ${projectPath}`);
};
