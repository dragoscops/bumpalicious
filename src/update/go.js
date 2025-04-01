/**
 * Go project version update functionality
 * @module update/go
 */

import fs from 'fs-extra';
import path from 'path';
import * as logging from '../utils/logging.js';
import {GO_VERSION_FILES} from '../core/constants.js';

/**
 * Update version in a Go source file
 *
 * @param {string} filePath - Path to the file
 * @param {string} content - File content
 * @param {string} newVersion - New version to set
 * @returns {Promise<boolean>} - True if the file was updated
 */
const updateGoSourceFile = async (filePath, content, newVersion) => {
  let updated = false;
  let updatedContent = content;

  // Various patterns for defining version constants in Go
  const patterns = [
    [/(const|var)\s+Version\s*=\s*["']([^"']*)["']/g, `$1 Version = "${newVersion}"`],
    [/(const|var)\s+version\s*=\s*["']([^"']*)["']/g, `$1 version = "${newVersion}"`],
    [
      /func\s+Version\(\)\s*string\s*{\s*return\s*["']([^"']*)["']\s*}/g,
      `func Version() string { return "${newVersion}" }`,
    ],
  ];

  for (const [pattern, replacement] of patterns) {
    if (pattern.test(updatedContent)) {
      updatedContent = updatedContent.replace(pattern, replacement);
      updated = true;
    }
  }

  if (updated) {
    await fs.writeFile(filePath, updatedContent, 'utf8');
    return true;
  }

  return false;
};

/**
 * Update version in a Go project
 * Looking for go.mod files and common version patterns
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

    // Check if go.mod exists and update version if it contains version line
    const goModPath = path.join(projectPath, GO_VERSION_FILES[0]); // go.mod
    if (await fs.pathExists(goModPath)) {
      try {
        const content = await fs.readFile(goModPath, 'utf8');

        // Go modules don't typically have a version in go.mod, but some custom ones might
        if (content.includes('version =') || content.includes('version=')) {
          const updatedContent = content.replace(/version\s*=\s*["']([^"']*)["']/g, `version = "${newVersion}"`);

          if (updatedContent !== content) {
            await fs.writeFile(goModPath, updatedContent, 'utf8');
            logging.success(`Updated version in go.mod to ${newVersion}`);
            updated = true;
          }
        }
      } catch (error) {
        logging.error('Error updating go.mod:', error);
      }
    }

    // Check and update version.go files in various locations
    for (const file of GO_VERSION_FILES.slice(1, -1)) {
      // Skip go.mod and plain version file
      const filePath = path.join(projectPath, file);
      if (await fs.pathExists(filePath)) {
        try {
          const content = await fs.readFile(filePath, 'utf8');

          // Look for version constants
          if (content.includes('Version') || content.includes('version')) {
            const fileUpdated = await updateGoSourceFile(filePath, content, newVersion);
            if (fileUpdated) {
              updated = true;
            }
          }
        } catch (error) {
          logging.error(`Error updating ${path.basename(file)}:`, error);
        }
      }
    }

    // If no files were updated, create or update a version file
    if (!updated) {
      try {
        const versionPath = path.join(projectPath, GO_VERSION_FILES[GO_VERSION_FILES.length - 1]); // 'version'
        await fs.writeFile(versionPath, newVersion, 'utf8');
        logging.success(
          `${(await fs.pathExists(versionPath)) ? 'Updated' : 'Created'} version file with version ${newVersion}`,
        );
        updated = true;
      } catch (error) {
        logging.error('Error creating/updating version file:', error);
        throw error; // We really need this to succeed if nothing else worked
      }
    }

    return updated;
  } catch (error) {
    logging.error(`Failed to update Go project version: ${error.message}`);
    throw error;
  }
};
