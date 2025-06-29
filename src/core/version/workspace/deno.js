import path from 'node:path';
import JSONC from 'tiny-jsonc';

import * as d from '../detect.js';
import * as u from '../update.js';

/**
 * @typedef {import('../detect.js').ProjectInfo} ProjectInfo
 */

/**
 * Detect version from a Deno project
 * Looking for deno.json, deno.jsonc, jsr.json, or package.json files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<ProjectInfo>} - Detected version
 */
export const detect = async (projectPath) =>
  d.anyOf(projectPath, 'deno', [
    d.configParser(path.join(projectPath, 'deno.jsonc'), {
      parser: JSONC.parse,
      version: ['version'],
      name: ['name'],
    }),
    ...['deno.json', 'jsr.json', 'package.json'].map((file) =>
      d.configParser(path.join(projectPath, file), {
        parser: JSON.parse,
        version: ['version'],
        name: ['name'],
      }),
    ),
  ]);

/**
 * Update version in a Deno project
 * Looking for deno.jsonc, deno.json, jsr.json, or package.json files
 * Updates all files found since Deno projects may publish to multiple repositories
 *
 * @param {string} projectPath - Path to the project
 * @param {string} newVersion - New version to set
 * @returns {Promise<void>}
 */
export const update = async (projectPath, newVersion) =>
  u.updateAll(projectPath, 'deno', newVersion, [
    u.configUpdater(path.join(projectPath, 'deno.jsonc'), {
      parser: JSONC.parse,
      serializer: (data) => JSON.stringify(data, null, 2),
      version: ['version'],
    }),
    ...['deno.json', 'jsr.json', 'package.json'].map((file) =>
      u.configUpdater(path.join(projectPath, file), {
        parser: JSON.parse,
        serializer: (data) => JSON.stringify(data, null, 2),
        version: ['version'],
      }),
    ),
  ]);
