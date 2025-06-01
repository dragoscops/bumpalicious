/**
 * Node.js project version and name detection
 * @module detect/node
 */

import path from 'path';
import * as d from '../detect.js';
import * as u from '../update.js';

/**
 * Detect version from a Node.js project
 * Looking for jsr.json or package.json files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<NodeConfig>} - Detected version
 */
export const detect = async (projectPath) =>
  d.anyOf(projectPath, 'node', [
    ...['jsr.json', 'package.json'].map((file) =>
      d.configParser(path.join(projectPath, file), {
        parser: JSON.parse,
        version: ['version'],
        name: ['name'],
      }),
    ),
  ]);

/**
 * Update version in a Node.js project
 * Looking for jsr.json or package.json files
 * Updates all files found since Node.js projects may publish to multiple repositories
 *
 * @param {string} projectPath - Path to the project
 * @param {string} newVersion - New version to set
 * @returns {Promise<void>}
 */
export const update = async (projectPath, newVersion) =>
  u.updateAll(projectPath, 'node', newVersion, [
    ...['jsr.json', 'package.json'].map((file) =>
      u.configUpdater(path.join(projectPath, file), {
        parser: JSON.parse,
        serializer: (data) => JSON.stringify(data, null, 2),
        version: ['version'],
      }),
    ),
  ]);
