import path from 'node:path';
import * as d from '../detect.js';
import * as u from '../update.js';

/**
 * @typedef {import('../detect.js').ProjectInfo} ProjectInfo
 */

/**
 * Detect version from a text-based project
 * Looking for version or VERSION files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<ProjectInfo>} - Detected version
 */
export const detect = async (projectPath) =>
  d.anyOf(projectPath, 'text', [
    ...['version', 'version.txt', 'VERSION', 'VERSION.txt'].map((file) =>
      d.configParser(path.join(projectPath, file), {
        parser: (data) => data.trim(), // pass through raw content and trim
        version: [(content) => content],
        name: [() => path.basename(path.normalize(projectPath))],
      }),
    ),
  ]);

/**
 * Update version in a text-based project
 * Looking for version, version.txt, VERSION, or VERSION.txt files
 * Updates all files found since text projects may have multiple version files
 *
 * @param {string} projectPath - Path to the project
 * @param {string} newVersion - New version to set
 * @returns {Promise<void>}
 */
export const update = async (projectPath, newVersion) =>
  u.updateAll(projectPath, 'text', newVersion, [
    ...['version', 'version.txt', 'VERSION', 'VERSION.txt'].map((file) =>
      u.configUpdater(path.join(projectPath, file), {
        parser: (data) => data.trim(),
        serializer: (data) => data.trim(),
        version: [[/^(.*)$/m, newVersion]],
      }),
    ),
  ]);
