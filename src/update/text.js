/**
 * Text-based project version update functionality
 * @module update/text
 */

import fs from 'fs-extra';
import path from 'path';
import * as logging from '../utils/logging.js';

/**
 * List of potential version file names to check
 */
const VERSION_FILES = ['version', 'VERSION', 'version.txt', 'VERSION.txt'];

/**
 * Update version in a text-based project
 * Looking for version or VERSION files
 *
 * @param {Object} options - Update options
 * @param {string} options.projectPath - Path to the project
 * @param {string} options.newVersion - New version to set
 * @returns {Promise<boolean>} - True if the update was successful
 * @throws {Error} - If version update fails
 */
export const updateVersion = async ({projectPath, newVersion}) => {
  try {
    let updated = false;

    // First check if any existing version files exist
    for (const versionFile of VERSION_FILES) {
      const versionPath = path.join(projectPath, versionFile);
      if (await fs.pathExists(versionPath)) {
        try {
          await fs.writeFile(versionPath, newVersion, 'utf8');
          logging.success(`Updated version in ${versionFile} to ${newVersion}`);
          updated = true;
          break; // Only update the first version file we find
        } catch (error) {
          logging.error(`Error updating ${versionFile}:`, error);
        }
      }
    }

    // If no version file was found, create one
    if (!updated) {
      const versionPath = path.join(projectPath, 'version');
      await fs.writeFile(versionPath, newVersion, 'utf8');
      logging.success(`Created version file with version ${newVersion}`);
      updated = true;
    }

    return updated;
  } catch (error) {
    logging.error(`Failed to update text project version: ${error.message}`);
    throw error;
  }
};
