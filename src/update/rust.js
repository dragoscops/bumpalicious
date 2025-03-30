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
 * @returns {Promise<boolean>} - True if the update was successful
 * @throws {Error} - If version update fails
 */
export const updateVersion = async ({projectPath, newVersion}) => {
  try {
    let updated = false;

    // Check for Cargo.toml
    const cargoPath = path.join(projectPath, 'Cargo.toml');
    if (await fs.pathExists(cargoPath)) {
      try {
        // Try using TOML parser first
        const content = await fs.readFile(cargoPath, 'utf8');

        try {
          // Parse TOML
          const cargoData = toml.parse(content);

          // Update version in package section
          if (cargoData.package) {
            cargoData.package.version = newVersion;

            // Convert back to TOML
            const updatedContent = toml.stringify(cargoData);
            await fs.writeFile(cargoPath, updatedContent, 'utf8');
            logging.success(`Updated version in Cargo.toml to ${newVersion}`);
            updated = true;
          } else {
            logging.error(`Failed to find package section in Cargo.toml`);
          }
        } catch (parseError) {
          // If TOML parsing fails, try regex-based approach as fallback
          logging.error('Error parsing Cargo.toml:', parseError);

          // Regex-based update as fallback
          const versionRegex = /(version\s*=\s*")([^"]+)(")/;
          if (versionRegex.test(content)) {
            const updatedContent = content.replace(versionRegex, `$1${newVersion}$3`);
            await fs.writeFile(cargoPath, updatedContent, 'utf8');
            logging.success(`Updated version in Cargo.toml to ${newVersion} (using regex)`);
            updated = true;
          }
        }
      } catch (error) {
        logging.error('Error updating Cargo.toml:', error);
      }
    }

    // If no files were updated, create a version file
    if (!updated) {
      const versionPath = path.join(projectPath, 'version');
      await fs.writeFile(versionPath, newVersion, 'utf8');
      logging.success(`Created version file with version ${newVersion}`);
      updated = true;
    }

    return updated;
  } catch (error) {
    logging.error(`Failed to update Rust project version: ${error.message}`);
    throw error;
  }
};
