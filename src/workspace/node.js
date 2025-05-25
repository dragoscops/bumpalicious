/**
 * Node.js project version and name detection
 * @module detect/node
 */

import path from 'path';
import * as d from '../core/version/detect.js';

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
