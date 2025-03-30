/**
 * Text-based project version and name detection
 * @module detect/text
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * List of potential version file names to check
 */
const VERSION_FILES = ['version', 'VERSION', 'version.txt', 'VERSION.txt'];

/**
 * Detect version from a text-based project
 * Looking for version or VERSION files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If version could not be detected
 */
export const detectVersion = async (projectPath) => {
  for (const versionFile of VERSION_FILES) {
    const filePath = path.join(projectPath, versionFile);

    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8');
      const version = content.trim();
      if (version) {
        return version;
      }
    }
  }

  throw new Error('Could not detect version in text project');
};

/**
 * Detect name from a text-based project
 * Using directory name as project name
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected name (directory name)
 */
export const detectName = async (projectPath) => {
  return path.basename(path.normalize(projectPath));
};
