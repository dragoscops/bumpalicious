/**
 * Deno project version update functionality
 * @module update/deno
 */

import fs from 'fs-extra';
import path from 'path';
import {NODE_VERSION_FILES} from '../core/constants.js';
import * as logging from '../utils/logging.js';

/**
 * Update version in a Node.js project
 * Looking for jsr.json, or package.json files
 *
 * @param {Object} options - Update options
 * @param {string} options.projectPath - Path to the project
 * @param {string} options.newVersion - New version to set
 */
export const updateVersion = async ({projectPath, newVersion}) => {
  for (const file of NODE_VERSION_FILES) {
    const filePath = path.join(projectPath, file);
    if (await fs.pathExists(filePath)) {
      try {
        const config = await fs.readJson(filePath);
        config.version = newVersion;
        await fs.writeJson(filePath, config, {spaces: 2});
        return;
      } catch (error) {
        logging.error(`Failed to update Deno project version: ${error.message}`);
      }
    }
  }

  logging.error(`No version file found in the Deno project at ${projectPath}`);
};
