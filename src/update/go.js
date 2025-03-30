/**
 * Go project version update functionality
 * @module update/go
 */

import fs from 'fs-extra';
import path from 'path';
import * as logging from '../utils/logging.js';

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
    const goModPath = path.join(projectPath, 'go.mod');
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

    // Common version file patterns in Go projects
    const potentialFiles = [
      path.join(projectPath, 'version.go'),
      path.join(projectPath, 'pkg/version/version.go'),
      path.join(projectPath, 'internal/version/version.go'),
      path.join(projectPath, 'cmd/version.go'),
    ];

    for (const file of potentialFiles) {
      if (await fs.pathExists(file)) {
        try {
          const content = await fs.readFile(file, 'utf8');

          // Look for version constants
          if (content.includes('Version') || content.includes('version')) {
            let updatedContent = content;

            // Various patterns for defining version constants in Go
            updatedContent = updatedContent.replace(
              /(const|var)\s+Version\s*=\s*["']([^"']*)["']/g,
              `$1 Version = "${newVersion}"`,
            );

            updatedContent = updatedContent.replace(
              /(const|var)\s+version\s*=\s*["']([^"']*)["']/g,
              `$1 version = "${newVersion}"`,
            );

            // Version function that returns a string constant
            updatedContent = updatedContent.replace(
              /func\s+Version\(\)\s*string\s*{\s*return\s*["']([^"']*)["']\s*}/g,
              `func Version() string { return "${newVersion}" }`,
            );

            if (updatedContent !== content) {
              await fs.writeFile(file, updatedContent, 'utf8');
              logging.success(`Updated version in ${path.basename(file)} to ${newVersion}`);
              updated = true;
            }
          }
        } catch (error) {
          logging.error(`Error updating ${path.basename(file)}:`, error);
        }
      }
    }

    // If no files were updated, create a version.txt file
    if (!updated) {
      try {
        const versionPath = path.join(projectPath, 'version');
        await fs.writeFile(versionPath, newVersion, 'utf8');
        logging.success(`Created version file with version ${newVersion}`);
        updated = true;
      } catch (error) {
        logging.error('Error creating version file:', error);
        throw error; // We really need this to succeed if nothing else worked
      }
    }

    return updated;
  } catch (error) {
    logging.error(`Failed to update Go project version: ${error.message}`);
    throw error;
  }
};
