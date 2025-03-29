/**
 * Rust version update module
 * @module update/rust
 */

import fs from 'fs-extra';
import * as logging from '../utils/logging.js';

/**
 * Update version in Cargo.toml file
 * 
 * @param {string} filePath - Path to Cargo.toml file
 * @param {string} newVersion - New version to set
 * @returns {Promise<boolean>} - Success status
 */
export const updateCargoToml = async (filePath, newVersion) => {
  try {
    let content = await fs.readFile(filePath, 'utf8');
    
    // Update version in Cargo.toml
    // Pattern matches: version = "x.y.z" or version="x.y.z"
    const versionRegex = /(version\s*=\s*")([^"]+)(")/;
    
    if (!versionRegex.test(content)) {
      logging.error(`Failed to find version pattern in ${filePath}`);
      return false;
    }
    
    content = content.replace(versionRegex, `$1${newVersion}$3`);
    await fs.writeFile(filePath, content, 'utf8');
    
    logging.info(`Updated version to ${newVersion} in ${filePath}`);
    return true;
  } catch (error) {
    logging.error(`Failed to update version in ${filePath}`, error);
    return false;
  }
};

/**
 * Update Rust project version
 * 
 * @param {Object} options - Update options
 * @param {string} options.projectPath - Path to the project 
 * @param {string} options.newVersion - New version to set
 * @param {string} options.manifestPath - Path to Cargo.toml
 * @returns {Promise<boolean>} - Success status
 */
export const updateVersion = async ({ projectPath, newVersion, manifestPath }) => {
  const tomlPath = manifestPath || `${projectPath}/Cargo.toml`;
  
  if (!await fs.pathExists(tomlPath)) {
    logging.error(`Cargo.toml not found at ${tomlPath}`);
    return false;
  }
  
  // Update the Cargo.toml version
  return await updateCargoToml(tomlPath, newVersion);
};

export default updateVersion;