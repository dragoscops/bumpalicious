/**
 * Deno project version and name detection
 * @module detect/deno
 */

import fs from 'fs-extra';
import path from 'path';
import JSONC from 'tiny-jsonc';

import {DENO_VERSION_FILES} from './constants.js';
import * as logging from '../utils/logging.js';

/**
 * @typedef {Object} DenoConfig
 * @property {string} name - Project name
 * @property {string} version - Project version
 */

/**
 * Detect version from a Deno project
 * Looking for deno.json, deno.jsonc, jsr.json, or package.json files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<DenoConfig>} - Detected version
 */
export const detect = async (projectPath) => {
  const defaultName = path.basename(path.normalize(projectPath));

  for (const file of DENO_VERSION_FILES) {
    const configPath = path.join(projectPath, file);
    const exists = await fs.pathExists(configPath);

    if (exists) {
      try {
        const config = await (configPath.endsWith('jsonc')
          ? fs.readFile(configPath).then(JSONC.parse)
          : fs.readJson(configPath));
        return {
          name: config.name || defaultName,
          version: config.version, // || '0.0.1',
        };
      } catch (error) {
        logging.error(`Error parsing ${file} file:`, error);
      }
    }
  }

  logging.error(`No version file found in the Deno project at ${projectPath}`);
};

/**
 * Update version in a Deno project
 * Looking for deno.json, deno.jsonc, jsr.json, or package.json files
 *
 * @param {Object} options - Update options
 * @param {string} options.projectPath - Path to the project
 * @param {string} options.newVersion - New version to set
 */
export const updateVersion = async ({projectPath, newVersion}) => {
  for (const file of DENO_VERSION_FILES) {
    const configPath = path.join(projectPath, file);
    const exists = await fs.pathExists(configPath);

    if (exists) {
      try {
        let config = await (configPath.endsWith('jsonc')
          ? fs.readFile(configPath).then(JSONC.parse)
          : fs.readJson(configPath));

        if (configPath.endsWith('jsonc')) {
          if (!config.version) {
            return fs.writeJson(configPath, {version: newVersion}, {spaces: 2});
          }

          config = await fs.readFile(configPath, 'utf8');
          config = config.replace(/"version"\s*:\s*"[^"]*"/g, `"version": "${newVersion}"`);
          return fs.writeFile(configPath, config);
        }

        config.version = newVersion;
        return fs.writeJson(configPath, config, {spaces: 2});
      } catch (error) {
        logging.error(`Failed to update Deno project version: ${error.message}`, error);
      }
    }
  }

  logging.error(`No version file found in the Deno project at ${projectPath}`);
};
