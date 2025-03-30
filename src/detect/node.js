/**
 * Node.js project version and name detection
 * @module detect/node
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * List of potential version file names to check
 */
const VERSION_FILES = ['jsr.json', 'package.json'];

/**
 * Detect version from a Node.js project
 * Looking for package.json or jsr.json files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If version could not be detected
 */
export const detectVersion = async (projectPath) => {
  // Check for jsr.json, package.json
  for (const file of VERSION_FILES) {
    const configPath = path.join(projectPath, file);

    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      if (config.version) {
        return config.version;
      }
    }
  }

  throw new Error('Could not detect version in Node.js project');
};

/**
 * Detect name from a Node.js project
 * Looking for package.json or jsr.json files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected name
 * @throws {Error} - If name could not be detected
 */
export const detectName = async (projectPath) => {
  // Check for jsr.json, package.json
  for (const file of VERSION_FILES) {
    const configPath = path.join(projectPath, file);

    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      if (config.name) {
        return config.name;
      }
    }
  }

  // Default to current directory name
  return path.basename(path.normalize(projectPath));
};
