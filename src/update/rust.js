/**
 * Rust version update module
 * @module update/rust
 */

import fs from 'fs-extra';
import path from 'path';
import toml from '@iarna/toml';
import * as logging from '../utils/logging.js';

/**
 * Update version in a Rust project
 * Looking for Cargo.toml files
 *
 * @param {Object} options - Update options
 * @param {string} options.projectPath - Path to the project
 * @param {string} options.newVersion - New version to set
 */
export const updateVersion = async ({projectPath, newVersion}) => {
  const cargoPath = path.join(projectPath, 'Cargo.toml');
  if (await fs.pathExists(cargoPath)) {
    try {
      const content = await fs.readFile(cargoPath, 'utf8');
      const cargoData = toml.parse(content);

      cargoData.package = cargoData.package || {};
      cargoData.package.version = newVersion;

      const updatedContent = toml.stringify(cargoData);
      await fs.writeFile(cargoPath, updatedContent, 'utf8');

      return;
    } catch (error) {
      logging.error('Error updating Cargo.toml:', error);
    }
  }

  logging.error(`No version file found in the Deno project at ${projectPath}`);
};
