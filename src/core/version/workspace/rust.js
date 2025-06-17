import toml from '@iarna/toml';
import path from 'path';
import * as d from '../detect.js';
import * as u from '../update.js';

/**
 * @typedef {import('../detect.js').ProjectInfo} ProjectInfo
 */

/**
 * Detect version from a Rust project
 * Looking for Cargo.toml file
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<ProjectInfo>} - Detected version
 */
export const detect = async (projectPath) =>
  d.anyOf(projectPath, 'rust', [
    d.configParser(path.join(projectPath, 'Cargo.toml'), {
      parser: toml.parse,
      version: ['package.version'],
      name: ['package.name'],
    }),
  ]);

/**
 * Update version in a Rust project
 * Looking for Cargo.toml file
 * Updates the file if found
 *
 * @param {string} projectPath - Path to the project
 * @param {string} newVersion - New version to set
 * @returns {Promise<void>}
 */
export const update = async (projectPath, newVersion) =>
  u.updateAll(projectPath, 'rust', newVersion, [
    u.configUpdater(path.join(projectPath, 'Cargo.toml'), {
      parser: toml.parse,
      serializer: toml.stringify,
      version: ['package.version'],
    }),
  ]);
