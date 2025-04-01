/**
 * Go project version and name detection
 * @module detect/go
 */

import fs from 'fs-extra';
import path from 'path';
import {GO_VERSION_FILES} from '../core/constants.js';
import * as logging from '../utils/logging.js';

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
 * Detect version from a Go project
 * Looking for go.mod file or various version declaration files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected version
 */
export const detectVersion = async (projectPath) => {
  const goModPath = path.join(projectPath, GO_VERSION_FILES[0]); // go.mod
  if (await fs.pathExists(goModPath)) {
    try {
      const content = await fs.readFile(goModPath, 'utf8');

      // Some go.mod files might contain a version declaration
      const versionMatch = content.match(/version\s*=\s*["']([^"']*)["']/);
      if (versionMatch && versionMatch[1]) {
        return versionMatch[1];
      }
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
        const version = extractVersionFromGoSource(content);
        if (version) {
          return version;
        }
      } catch (error) {
        logging.error(`Error parsing ${file}:`, error);
      }
    }
  }

  logging.error(`No version file found in the Go project at ${projectPath}, using default`);
};

/**
 * Detect name from a Go project
 * Looking for go.mod file or various version declaration files
 *
 * @param {string} projectPath - Project to read details from
 * @returns {Promise<string>} - Detected name
 */
export const detectName = async (projectPath) => {
  const goModPath = path.join(projectPath, GO_VERSION_FILES[0]); // go.mod
  if (await fs.pathExists(goModPath)) {
    try {
      const content = await fs.readFile(goModPath, 'utf8');

      return extractModuleNameFromGoMod(content);
    } catch (error) {
      logging.error('Error parsing go.mod:', error);
    }
  }

  // Default to current directory name
  return path.basename(path.normalize(projectPath));
};
