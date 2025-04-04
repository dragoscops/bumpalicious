/**
 * Text-based project version update functionality
 * @module update/text
 */

import fs from 'fs-extra';
import path from 'path';
import {TEXT_VERSION_FILES} from '../core/constants.js';
import * as logging from '../utils/logging.js';

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
