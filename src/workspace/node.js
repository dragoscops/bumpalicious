/**
 * Deno project version and name detection
 * @module detect/deno
 */

import fs from 'fs-extra';
import path from 'path';
import {NODE_VERSION_FILES} from './constants.js';
import * as logging from '../utils/logging.js';

/**
 * @typedef {Object} NodeConfig
 * @property {string} name - Project name
 * @property {string} version - Project version
 */

/**
 * Detect version from a Deno project
 * Looking for deno.json, deno.jsonc, jsr.json, or package.json files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<NodeConfig>} - Detected version
 */
export const detect = async (projectPath) => {
  // Check for jsr.json, package.json
  for (const file of NODE_VERSION_FILES) {
    const configPath = path.join(projectPath, file);

    if (await fs.pathExists(configPath)) {
      try {
        const denoConfig = await fs.readJson(configPath);
        return {
          name: denoConfig.name || path.basename(path.normalize(projectPath)),
          version: denoConfig.version, // || '0.0.1',
        };
      } catch (error) {
        logging.error(`Error parsing ${file} file:`, error);
      }
    }
  }

  logging.error(`No version file found in the NodeJS project at ${projectPath}`);
};

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
