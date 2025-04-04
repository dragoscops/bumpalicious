/**
 * Rust project version and name detection
 * @module detect/rust
 */

import fs from 'fs-extra';
import path from 'path';
import {execa} from 'execa';
import toml from '@iarna/toml';
import * as logging from '../utils/logging.js';

/**
 * Detect version from a Rust project
 * Looking for Cargo.toml file
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected version
 * @throws {Error} - If version could not be detected
 */
export const detectVersion = async (projectPath) => {
  const cargoPath = path.join(projectPath, 'Cargo.toml');

  if (await fs.pathExists(cargoPath)) {
    try {
      const content = await fs.readFile(cargoPath, 'utf8');
      const cargoData = toml.parse(content);

      if (cargoData?.package?.version) {
        return cargoData.package.version;
      }
    } catch (error) {
      logging.error(`Error parsing ${file} file:`, error);
    }
  }

  try {
    const {stdout} = await execa('cargo', ['pkgid'], {cwd: projectPath});
    const versionMatch = stdout.match(/@([^#]+)/);
    if (versionMatch) {
      return versionMatch[1];
    }
  } catch {
    // Ignore errors
  }
  
  logging.error(`No version file found in the Rust project at ${projectPath}`);
};

/**
 * Detect name from a Rust project
 * Looking for Cargo.toml file
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected name
 */
export const detectName = async (projectPath) => {
  const cargoPath = path.join(projectPath, 'Cargo.toml');

  // Check if Cargo.toml file exists
  if (await fs.pathExists(cargoPath)) {
    try {
      const content = await fs.readFile(cargoPath, 'utf8');
      const cargoData = toml.parse(content);

      if (cargoData.package && cargoData.package.name) {
        return cargoData.package.name;
      }
    } catch (error) {
      console.error('Error parsing Cargo.toml:', error);
    }
  }

  return path.basename(path.normalize(projectPath));
};
