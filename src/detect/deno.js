/**
 * Deno project version and name detection
 * @module detect/deno
 */

import fs from 'fs-extra';
import path from 'path';
import {DENO_VERSION_FILES} from '../core/constants.js';
import * as logging from '../utils/logging.js';

/**
 * Detect version from a Deno project
 * Looking for deno.json, deno.jsonc, jsr.json, or package.json files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected version
 */
export const detectVersion = async (projectPath) => {
  let configPath = path.join(projectPath, 'deno.jsonc');

  // Check for deno.jsonc (JSON with comments)
  if (await fs.pathExists(configPath)) {
    try {
      // Read as string first
      const content = await fs.readFile(configPath, 'utf8');
      // Simple comment stripping - remove lines starting with //
      const noComments = content
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n');

      const denoConfig = JSON.parse(noComments);
      if (denoConfig.version) {
        return denoConfig.version;
      }
    } catch (error) {
      logging.error('Error parsing deno.jsonc:', error);
    }
  }

  // Check for deno.json, jsr.json, package.json
  for (const file of DENO_VERSION_FILES.slice(1)) {
    configPath = path.join(projectPath, file);

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
  let configPath = path.join(projectPath, 'deno.jsonc');

  // Check for deno.jsonc (JSON with comments)
  if (await fs.pathExists(configPath)) {
    try {
      // Read as string first
      const content = await fs.readFile(configPath, 'utf8');
      // Simple comment stripping - remove lines starting with //
      const noComments = content
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n');

      const denoConfig = JSON.parse(noComments);
      if (denoConfig.name) {
        return denoConfig.name;
      }
    } catch (error) {
      logging.error('Error parsing deno.jsonc:', error);
    }
  }

  // Check for deno.json, jsr.json, package.json
  for (const file of DENO_VERSION_FILES.slice(1)) {
    configPath = path.join(projectPath, file);

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
