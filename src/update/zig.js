/**
 * Zig project version update
 * @module update/zig
 */

import fs from 'fs-extra';
import path from 'path';
import * as logging from '../utils/logging.js';
import {ZIG_VERSION_FILES} from '../core/constants.js';

/**
 * Updates a Zig project's version
 *
 * @param {Object} options - Update options
 * @param {string} options.projectPath - Path to the project
 * @param {string} options.newVersion - New version to set
 * @returns {Promise<boolean>} - True if the update was successful
 */
export const updateVersion = async ({projectPath, newVersion}) => {
  const patterns = [
    [/version\s*=\s*"([^"]+)"/, `version = "${newVersion}"`],
    [/\.version\s*=\s*"([^"]+)"/, `.version = "${newVersion}"`],
    [/(const\s+VERSION\s*=\s*)"([^"]+)"/i, `$1"${newVersion}"`],
  ];

  for (const configPath of ZIG_VERSION_FILES) {
    const configFile = path.join(projectPath, configPath);
    if (await fs.pathExists(configFile)) {
      try {
        const content = await fs.readFile(configFile, 'utf8');

        for (const [pattern, replacement] of patterns) {
          if (pattern.test(content)) {
            await fs.writeFile(filePath, content.replace(pattern, replacement), 'utf8');
            return;
          }
        }
      } catch (error) {
        logging.error(`Failed to update Zig project version: ${error.message}`);
      }
    }
  }

  logging.error(`No version file found in the Zig project at ${projectPath}`);
};
