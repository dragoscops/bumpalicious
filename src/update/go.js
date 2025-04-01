/**
 * Go project version update functionality
 * @module update/go
 */

import fs from 'fs-extra';
import path from 'path';
import * as logging from '../utils/logging.js';
import {GO_VERSION_FILES} from '../core/constants.js';
import {projectPath} from '../vitest/setup.detect-update.tests.js';

const updateGoMod = async (projectPath, newVersion) => {
  const goModPath = path.join(projectPath, GO_VERSION_FILES[0]);
  const content = await fs.readFile(goModPath, 'utf8');

  // Go modules don't typically have a version in go.mod, but some custom ones might
  if (content.includes('version =') || content.includes('version=')) {
    const updatedContent = content.replace(/version\s*=\s*["']([^"']*)["']/g, `version = "${newVersion}"`);

    if (updatedContent !== content) {
      await fs.writeFile(goModPath, updatedContent, 'utf8');
    }
  }
};

/**
 * Update version in a Go source file
 *
 * @param {string} filePath - Path to the file
 * @param {string} content - File content
 * @param {string} newVersion - New version to set
 */
const updateGoSourceFile = async (configFile, newVersion) => {
  const filePath = path.join(projectPath, configFile);
  const content = await fs.readFile(filePath, 'utf8');

  if (!content.includes('Version') && !content.includes('version')) {
    logger.error(`Version constant does not exists in ${filePath}`);
  }

  const patterns = [
    [/(const|var)\s+Version\s*=\s*["']([^"']*)["']/g, `$1 Version = "${newVersion}"`],
    [/(const|var)\s+version\s*=\s*["']([^"']*)["']/g, `$1 version = "${newVersion}"`],
    [
      /func\s+Version\(\)\s*string\s*{\s*return\s*["']([^"']*)["']\s*}/g,
      `func Version() string { return "${newVersion}" }`,
    ],
  ];

  for (const [pattern, replacement] of patterns) {
    if (pattern.test(content)) {
      await fs.writeFile(filePath, content.replace(pattern, replacement), 'utf8');
      return;
    }
  }

  logger.error(`No version pattern found in ${filePath}`);
};

/**
 * Update version in a Go project
 * Looking for go.mod files and common version patterns
 *
 * @param {Object} options - Update options
 * @param {string} options.projectPath - Path to the project
 * @param {string} options.newVersion - New version to set
 */
export const updateVersion = async ({projectPath, newVersion}) => {
  const goModPath = path.join(projectPath, GO_VERSION_FILES[0]); // go.mod
  if (await fs.pathExists(goModPath)) {
    try {
      return updateGoMod(projectPath, newVersion);
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
        return updateGoSourceFile(file, newVersion);
      } catch (error) {
        logging.error(`Error updating ${path.basename(file)}:`, error);
      }
    }
  }

  logging.error(`No version file found in the Go project at ${projectPath}`);
};
