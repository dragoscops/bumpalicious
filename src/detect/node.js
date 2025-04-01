/**
 * Deno project version and name detection
 * @module detect/deno
 */

import fs from 'fs-extra';
import path from 'path';
import {NODE_VERSION_FILES} from '../core/constants.js';
import * as logging from '../utils/logging.js';

/**
 * Detect version from a Deno project
 * Looking for deno.json, deno.jsonc, jsr.json, or package.json files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected version
 */
export const detectVersion = async (projectPath) => {
  // Check for jsr.json, package.json
  for (const file of NODE_VERSION_FILES) {
    const configPath = path.join(projectPath, file);

    if (await fs.pathExists(configPath)) {
      try {
        const denoConfig = await fs.readJson(configPath);
        if (denoConfig.version) {
          return denoConfig.version;
        }
      } catch (error) {
        logging.error(`Error parsing ${file} file:`, error);
      }
    }
  }

  logging.error(`No version file found in the Deno project at ${projectPath}`);
};

/**
 * Detect name from a Deno project
 * Looking for deno.json, deno.jsonc, jsr.json, or package.json files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected name
 */
export const detectName = async (projectPath) => {
  // Check for jsr.json, package.json
  for (const file of NODE_VERSION_FILES) {
    const configPath = path.join(projectPath, file);

    if (await fs.pathExists(configPath)) {
      try {
        const config = await fs.readJson(configPath);
        if (config.name) {
          return config.name;
        }
      } catch (error) {
        logging.error(`Error parsing ${file} file:`, error);
      }
    }
  }

  // Default to current directory name
  return path.basename(path.normalize(projectPath));
};
