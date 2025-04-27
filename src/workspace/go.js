/**
 * Go project version and name detection
 * @module detect/go
 */

import fs from 'fs-extra';
import path from 'path';
import {GO_VERSION_FILES} from './constants.js';
import * as logging from '../utils/logging.js';

/**
 * @typedef {Object} GoConfig
 * @property {string} name - Project name
 * @property {string} version - Project version
 */

/**
 * Detect version from a Go project
 * Looking for go.mod file or various version declaration files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<GoConfig>} - Detected version
 */
export const detect = async (projectPath) => {
  const defaultName = path.basename(path.normalize(projectPath));

  const goModPath = path.join(projectPath, GO_VERSION_FILES[0]); // go.mod
  if (await fs.pathExists(goModPath)) {
    try {
      const content = await fs.readFile(goModPath, 'utf8');

      // Some go.mod files might contain a version declaration
      const versionMatch = content.match(/version\s*=\s*["']([^"']*)["']/);
      return {
        name: extractModuleNameFromGoMod(content) || defaultName,
        version: versionMatch && versionMatch[1] ? versionMatch[1] : null,
      };
    } catch (error) {
      logging.error('Error parsing go.mod:', error);
    }
  }

  // Check for version.go files in various locations
  for (const file of GO_VERSION_FILES.slice(1)) {
    const filePath = path.join(projectPath, file);
    const exists = await fs.pathExists(filePath);
    if (await fs.pathExists(filePath)) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        return {
          name: defaultName,
          version: extractVersionFromGoSource(content),
        };
      } catch (error) {
        logging.error(`Error parsing ${file}:`, error);
      }
    }
  }

  logging.error(`No version file found in the Go project at ${projectPath}, using default`);
};

/**
 * Extract module name from go.mod content
 *
 * @param {string} content - go.mod file content
 * @returns {string|null} - Extracted module name or null if not found
 */
const extractModuleNameFromGoMod = (content) => {
  const moduleMatch = content.match(/^module\s+([\w\d./\-@:]+)/m);
  if (!moduleMatch || !moduleMatch[1]) return null;

  const fullPath = moduleMatch[1];
  const parts = fullPath.split('/');

  // For paths like github.com/username/repo, return the repo name
  return parts.length > 2 ? parts[parts.length - 1] : fullPath;
};

/**
 * Extract version from Go source file
 *
 * @param {string} content - File content
 * @returns {string|null} - Extracted version or null if not found
 */
const extractVersionFromGoSource = (content) => {
  // Look for various version declarations in go files
  const patterns = [
    /(const|var)\s+Version\s*=\s*["']([^"']*)["']/,
    /(const|var)\s+version\s*=\s*["']([^"']*)["']/,
    /func\s+Version\(\)\s*string\s*{\s*return\s*["']([^"']*)["']\s*}/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      // Return the captured version string
      return match[pattern === patterns[2] ? 1 : 2];
    }
  }
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
      return updateVersionInGoMod(goModPath, newVersion);
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
        return updateVersionInGoSourceFile(filePath, newVersion);
      } catch (error) {
        logging.error(`Error updating ${path.basename(file)}:`, error);
      }
    }
  }

  logging.error(`No version file found in the Go project at ${projectPath}`);
};

/**
 *
 * @param {string} configFile
 * @param {string} newVersion
 */
const updateVersionInGoMod = async (configFile, newVersion) => {
  const content = await fs.readFile(configFile, 'utf8');

  // Go modules don't typically have a version in go.mod, but some custom ones might
  if (content.includes('version =') || content.includes('version=')) {
    const updatedContent = content.replace(/version\s*=\s*["']([^"']*)["']/g, `version = "${newVersion}"`);

    if (updatedContent !== content) {
      await fs.writeFile(configFile, updatedContent, 'utf8');
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
const updateVersionInGoSourceFile = async (configFile, newVersion) => {
  const content = await fs.readFile(configFile, 'utf8');

  if (!content.includes('Version') && !content.includes('version')) {
    logger.error(`Version constant does not exists in ${configFile}`);
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
      await fs.writeFile(configFile, content.replace(pattern, replacement), 'utf8');
      return;
    }
  }

  logger.error(`No version pattern found in ${configFile}`);
};
