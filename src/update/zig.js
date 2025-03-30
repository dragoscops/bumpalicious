/**
 * Zig project version update
 * @module update/zig
 */

import fs from 'fs-extra';
import path from 'path';
import * as logging from '../utils/logging.js';

/**
 * Update version in a Zig build file
 *
 * @param {string} filePath - Path to the file
 * @param {string} content - File content
 * @param {string} newVersion - New version to set
 * @returns {Promise<boolean>} - True if the file was updated
 */
const updateZigFile = async (filePath, content, newVersion) => {
  let updated = false;
  let updatedContent = content;

  // List of patterns to replace
  const patterns = [
    [/version\s*=\s*"([^"]+)"/, `version = "${newVersion}"`],
    [/\.version\s*=\s*"([^"]+)"/, `.version = "${newVersion}"`],
    [/(const\s+VERSION\s*=\s*)"([^"]+)"/i, `$1"${newVersion}"`],
  ];

  for (const [pattern, replacement] of patterns) {
    if (pattern.test(updatedContent)) {
      updatedContent = updatedContent.replace(pattern, replacement);
      updated = true;
    }
  }

  if (updated) {
    await fs.writeFile(filePath, updatedContent, 'utf8');
    logging.success(`Updated version in ${path.basename(filePath)} to ${newVersion}`);
    return true;
  }

  return false;
};

/**
 * Updates a Zig project's version
 *
 * @param {Object} options - Update options
 * @param {string} options.projectPath - Path to the project
 * @param {string} options.newVersion - New version to set
 * @returns {Promise<boolean>} - True if the update was successful
 */
export const updateVersion = async ({projectPath, newVersion}) => {
  try {
    let updated = false;

    // First check build.zig.zon which is more common for version info
    const zonPath = path.join(projectPath, 'build.zig.zon');
    if (await fs.pathExists(zonPath)) {
      const content = await fs.readFile(zonPath, 'utf8');
      const zonUpdated = await updateZigFile(zonPath, content, newVersion);
      if (zonUpdated) {
        updated = true;
      }
    }

    // Then check build.zig
    const buildPath = path.join(projectPath, 'build.zig');
    if (await fs.pathExists(buildPath)) {
      const content = await fs.readFile(buildPath, 'utf8');
      const buildUpdated = await updateZigFile(buildPath, content, newVersion);
      if (buildUpdated) {
        updated = true;
      }
    }

    // If we haven't found any files to update, create a version file
    if (!updated) {
      const versionPath = path.join(projectPath, 'version');
      await fs.writeFile(versionPath, newVersion, 'utf8');
      logging.success(`Created version file with version ${newVersion}`);
      updated = true;
    }

    return updated;
  } catch (error) {
    logging.error(`Failed to update Zig project version: ${error.message}`);
    throw error;
  }
};
