/**
 * Node.js project version and name detection
 * @module detect/node
 */

import path from 'path';
import * as d from '../core/version/detect.js';
import * as u from '../core/version/update.js';

/**
 * Detect version from a Node.js project
 * Looking for jsr.json or package.json files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<NodeConfig>} - Detected version
 */
export const detect = async (projectPath) =>
  d.anyOf(projectPath, 'node', [
    d.configParser(path.join(projectPath, 'jsr.json'), {
      parser: JSON.parse,
      version: ['version'],
      name: ['name'],
    }),
    d.configParser(path.join(projectPath, 'package.json'), {
      parser: JSON.parse,
      version: ['version'],
      name: ['name'],
    }),
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
    u.configUpdater(path.join(projectPath, 'jsr.json'), {
      parser: JSON.parse,
      serializer: (data) => JSON.stringify(data, null, 2),
      version: ['version'],
    }),
    u.configUpdater(path.join(projectPath, 'package.json'), {
      parser: JSON.parse,
      serializer: (data) => JSON.stringify(data, null, 2),
      version: ['version'],
    }),
  ]);
