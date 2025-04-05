import fs from 'fs-extra';
import path from 'path';
import {execa} from 'execa';
import toml from '@iarna/toml';
import * as logging from '../utils/logging.js';

/**
 * @typedef {Object} RustConfig
 * @property {string} name - Project name
 * @property {string} version - Project version
 */

/**
 * Detect version from a Rust project
 * Looking for Cargo.toml file
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<RustConfig>} - Detected version
 */
export const detect = async (projectPath) => {
  const cargoPath = path.join(projectPath, 'Cargo.toml');

  if (await fs.pathExists(cargoPath)) {
    try {
      const content = await fs.readFile(cargoPath, 'utf8');
      const cargoData = toml.parse(content);

      return {
        name: cargoData?.package?.name || path.basename(path.normalize(projectPath)),
        version: cargoData?.package?.version,
      };
    } catch (error) {
      logging.error(`Error parsing ${file} file:`, error);
    }
  }

  // TODO: Maybe... we should have this fix @ some point
  // try {
  //   const {stdout} = await execa('cargo', ['pkgid'], {cwd: projectPath});
  //   const versionMatch = stdout.match(/@([^#]+)/);
  //   return {
  //     name: path.basename(path.normalize(projectPath)),
  //     version: versionMatch ? versionMatch[1] : undefined,
  //   }
  // } catch {
  //   // Ignore errors
  // }

  logging.error(`No version file found in the Rust project at ${projectPath}`);
};

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
